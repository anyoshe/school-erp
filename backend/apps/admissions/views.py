# admissions/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Application, ApplicationDocument, AdmissionFeePayment
from .serializers import (
    ApplicationSerializer,
    ApplicationCreateUpdateSerializer,
    ApplicationDocumentSerializer,
    AdmissionFeePaymentSerializer,
    ApplicationListSerializer
)
from apps.students.models import Student
from apps.school.models import School


class ApplicationViewSet(viewsets.ModelViewSet):
    """
    Main ViewSet for school staff/admins - full CRUD + enrollment
    """
    queryset = Application.objects.prefetch_related('documents', 'fee_payments').select_related('class_applied', 'school')
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'school', 'class_applied', 'gender', 'nationality']
    search_fields = ['first_name', 'last_name', 'admission_number', 'primary_guardian_name', 'primary_guardian_phone']
    ordering_fields = ['submitted_at', 'admission_number', 'status', 'created_at']
    ordering = ['-submitted_at']

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Application.objects.none()

        user = self.request.user

        # Superusers see all (bypass filters)
        if user.is_superuser:
            print(f"[DEBUG] Superuser {user.email} accessing all applications")
            return self.queryset

    # Prefer X-School-ID header (sent by frontend for current school)
        school_id_str = self.request.headers.get('X-School-ID')
        if school_id_str:
            try:
                from uuid import UUID
                school_id = UUID(school_id_str)
                print(f"[DEBUG] Using X-School-ID: {school_id} for user {user.email}")
                return self.queryset.filter(school_id=school_id)
            except ValueError:
                print(f"[DEBUG] Invalid X-School-ID: {school_id_str}")
                pass

    # Fallback: user's linked school(s) - but only if no header
        school = getattr(user, "school", None)
        if not school:
            schools_qs = getattr(user, "schools", None)
            if schools_qs:
                try:
                    schools = schools_qs.all()
                except AttributeError:
                    schools = list(schools_qs) if schools_qs else []
                
                if schools:
                    print(f"[DEBUG] Fallback to user schools: {[s.id for s in schools]}")
                    return self.queryset.filter(school__in=schools)

        if not school:
            print(f"[DEBUG] User {user.email} has no linked school")
            return Application.objects.none()

        print(f"[DEBUG] Using user.school: {school.id}")
        return self.queryset.filter(school=school)
    
    def get_serializer_class(self):
        if self.action in ['list']:
            return ApplicationListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return ApplicationCreateUpdateSerializer
        return ApplicationSerializer


    def perform_create(self, serializer):
        application = serializer.save(created_by=self.request.user)
        if application.status == Application.Status.ENROLLED:
            application.enroll_as_student(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'], url_path='enroll')
    def enroll(self, request, pk=None):
        """
        Custom action: Enroll accepted application as a Student
        Uses the model's enroll_as_student method
        """
        application = self.get_object()

        # Validation
        # Resolve user's school similarly to get_queryset
        user_school = getattr(request.user, "school", None)
        if not user_school:
            try:
                schools_qs = getattr(request.user, "schools", None)
                if schools_qs is not None:
                    user_school = schools_qs.first()
            except Exception:
                user_school = None

        if user_school is None or application.school != user_school:
            return Response({"detail": "You can only enroll applications from your own school."},
                            status=status.HTTP_403_FORBIDDEN)

        if application.status not in [Application.Status.ACCEPTED, Application.Status.ENROLLED]:
            return Response({"detail": "Only ACCEPTED or ENROLLED can be enrolled."}, status=400)

        # Optional: stricter check - require at least one fee payment
        if not application.fee_payments.exists():
            return Response({"detail": "Admission fee payment required before enrollment."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        if application.student:
            return Response({
                "detail": "Already enrolled.",
                "student_id": str(application.student.id)
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Use the model's method (cleaner than duplicating logic)
            student = application.enroll_as_student(created_by_user=request.user)
            
            return Response({
                "detail": "Student enrolled successfully",
                "student_id": str(student.id),
                "admission_number": student.admission_number,
                "student_name": student.full_name
            }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Enrollment failed: {str(e)}"}, 
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PublicApplicationSubmissionViewSet(viewsets.GenericViewSet):
    """
    Public endpoint for parents/students to submit applications.
    """
    queryset = Application.objects.none()
    serializer_class = ApplicationCreateUpdateSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 1. Get school ID from request
        school_id = request.data.get("school")
        if not school_id:
            return Response({"detail": "School ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Fetch school object safely
        try:
            school = School.objects.get(id=school_id)
        except School.DoesNotExist:
            return Response({"detail": "Invalid school ID"}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Use the status value sent by frontend (DRAFT or SUBMITTED)
        #    Default to DRAFT if somehow missing
        status_value = serializer.validated_data.get('status', Application.Status.DRAFT)

        # 4. Save with the real status
        application = serializer.save(
            school=school,
            status=status_value,           # ← now respects frontend value
            created_by=None
        )

        # Optional: log what was saved (for debugging)
        print(f"Public submission saved with status: {application.status}")

        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'], url_path='update')
    def update_draft(self, request, pk=None):
        # Public update for drafts only
        try:
            # Only allow updating DRAFT status applications
            application = Application.objects.get(id=pk, status=Application.Status.DRAFT)
        except Application.DoesNotExist:
            return Response({"detail": "Draft not found or not editable"}, status=404)

        serializer = self.get_serializer(application, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        print(f"Public update - ID: {pk}, Status: {application.status}")
        return Response(ApplicationSerializer(application).data)
    
    def retrieve(self, request, pk=None):
        """
        Allow public retrieval of a DRAFT application so the user can continue editing.
        """
        try:
            # ONLY allow viewing if it is still a draft. 
            # This prevents people from snooping on submitted/accepted applications.
            application = Application.objects.get(id=pk, status=Application.Status.DRAFT)
            serializer = ApplicationSerializer(application)
            return Response(serializer.data)
        except Application.DoesNotExist:
            return Response({"detail": "Draft not found"}, status=status.HTTP_404_NOT_FOUND)

# Optional: Separate ViewSets for documents/payments if needed later
class ApplicationDocumentViewSet(viewsets.ModelViewSet):
    queryset = ApplicationDocument.objects.all()
    serializer_class = ApplicationDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(application__school=self.request.user.school)


class AdmissionFeePaymentViewSet(viewsets.ModelViewSet):
    queryset = AdmissionFeePayment.objects.all()
    serializer_class = AdmissionFeePaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(application__school=self.request.user.school)