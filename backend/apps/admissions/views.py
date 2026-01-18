# # admissions/views.py
# from rest_framework.viewsets import ModelViewSet
# from rest_framework import permissions
# from rest_framework.decorators import action
# from rest_framework.response import Response
# from rest_framework.permissions import AllowAny
# from rest_framework import status
# from .models import Application
# from .serializers import ApplicationSerializer, ApplicationCreateUpdateSerializer
# from apps.students.serializers import StudentCreateUpdateSerializer  # Import for creating Student
# from apps.students.models import Student

# class ApplicationViewSet(ModelViewSet):
#     queryset = Application.objects.prefetch_related('documents', 'fee_payments').all().order_by('-submitted_at')
#     permission_classes = [permissions.IsAuthenticated]

#     def get_serializer_class(self):
#         if self.action in ['create', 'update', 'partial_update']:
#             return ApplicationCreateUpdateSerializer
#         return ApplicationSerializer

#     @action(detail=True, methods=['post'])
#     def onboard_to_student(self, request, pk=None):
#         """
#         Custom action: When application is ACCEPTED and fees paid, create pre-filled Student
#         """
#         application = self.get_object()
        
#         if application.status != Application.Status.ACCEPTED:
#             return Response({"detail": "Application must be ACCEPTED to onboard."}, status=status.HTTP_400_BAD_REQUEST)
        
#         if not application.fee_payments.exists():
#             return Response({"detail": "Admission fee must be paid before onboarding."}, status=status.HTTP_400_BAD_REQUEST)
        
#         if application.student:
#             return Response({"detail": "Student already onboarded.", "student_id": application.student.id}, status=status.HTTP_400_BAD_REQUEST)
        
#         # Pre-fill Student data
#         student_data = {
#             'admission_number': application.admission_number,
#             'first_name': application.first_name,
#             'last_name': application.last_name,
#             'gender': application.gender,
#             'date_of_birth': application.date_of_birth,
#             'current_class': application.class_applied,
#             'admission_date': application.admission_date,
#             'nationality': application.nationality,
#             'religion': application.religion,
#             'category': application.category,
#             # Add more mappings as needed (e.g., address fields)
#         }
        
#         student_serializer = StudentCreateUpdateSerializer(data=student_data)
#         if student_serializer.is_valid():
#             student = student_serializer.save()
#             application.student = student
#             application.status = Application.Status.ENROLLED
#             application.save()
#             return Response({
#                 "detail": "Student onboarded successfully.",
#                 "student_id": student.id
#             }, status=status.HTTP_201_CREATED)
#         else:
#             return Response(student_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    
# class PublicApplicationViewSet(ModelViewSet):
#     queryset = Application.objects.all()
#     serializer_class = ApplicationCreateUpdateSerializer
#     permission_classes = [AllowAny]

#     def perform_create(self, serializer):
#         serializer.save(
#             school=self.get_school_from_request(),
#             status=Application.Status.SUBMITTED
#         )

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
        """
        Restrict to the current user's school only
        """
        if not self.request.user.is_authenticated:
            return Application.objects.none()
        # Try to resolve the user's current school in a safe way without assuming attribute exists
        user = self.request.user
        school = getattr(user, "school", None)
        if not school:
            # If users have a related manager `schools` (many relation), pick the first
            try:
                schools_qs = getattr(user, "schools", None)
                if schools_qs is not None:
                    # `schools` might be a manager or iterable
                    first = None
                    try:
                        first = schools_qs.first()
                    except Exception:
                        # fallback if it's a list
                        first = list(schools_qs)[0] if len(list(schools_qs)) > 0 else None
                    school = first
            except Exception:
                school = None

        if not school:
            # No school associated with user — return no results for safety
            return Application.objects.none()

        return self.queryset.filter(school=school)

    def get_serializer_class(self):
        if self.action in ['list']:
            return ApplicationListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return ApplicationCreateUpdateSerializer
        return ApplicationSerializer

    def perform_create(self, serializer):
        """
        Auto-assign school from logged-in user
        """
        user = self.request.user
        school = getattr(user, "school", None)
        if not school:
            try:
                schools_qs = getattr(user, "schools", None)
                if schools_qs is not None:
                    school = schools_qs.first()
            except Exception:
                school = None

        serializer.save(
            school=school,
            created_by=self.request.user  # Optional: if you add created_by field later
        )

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

        if application.status != Application.Status.ACCEPTED:
            return Response({"detail": "Only ACCEPTED applications can be enrolled."}, 
                            status=status.HTTP_400_BAD_REQUEST)

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
    Optional: Public endpoint for parents/students to submit applications
    (No authentication required - use with caution or CAPTCHA)
    """
    queryset = Application.objects.none()
    serializer_class = ApplicationCreateUpdateSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Optional: require CAPTCHA or other anti-spam if public
        # For now, auto-set status to SUBMITTED
        application = serializer.save(
            school=School.objects.first(),  # ← Change: use a default/public school or validate code
            status=Application.Status.SUBMITTED
        )

        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)


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