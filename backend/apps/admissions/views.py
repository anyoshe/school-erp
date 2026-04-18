# admissions/views.py
from rest_framework import viewsets, status
from decimal import Decimal
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from .models import Application, ApplicationDocument, AdmissionFeePayment
from .serializers import (
    ApplicationSerializer,
    ApplicationCreateUpdateSerializer,
    ApplicationDocumentSerializer,
    AdmissionFeePaymentSerializer,
    ApplicationListSerializer
)
from apps.school.models import School
from django.utils import timezone


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
    
    def perform_update(self, serializer):
        instance = serializer.instance
        new_status = serializer.validated_data.get('status')

        if new_status:
            # Only set timestamp if status is actually changing to this value
            if new_status == Application.Status.OFFERED and instance.status != Application.Status.OFFERED:
                serializer.validated_data['offer_issued_at'] = timezone.now()
                # Optional: if frontend sends offer_method
                if 'offer_method' in serializer.validated_data:
                    serializer.validated_data['offer_method'] = serializer.validated_data['offer_method']

            if new_status == Application.Status.ACCEPTED and instance.status != Application.Status.ACCEPTED:
                serializer.validated_data['accepted_at'] = timezone.now()

        serializer.save()

        
    @action(detail=True, methods=['post'], url_path='enroll')
    @transaction.atomic
    def enroll(self, request, pk=None):
        """
        Enroll an accepted application as a Student with smart admission fee handling
        """
        application = self.get_object()

        # School permission check
        user_school = getattr(request.user, "school", None) or getattr(request.user, "schools", None).first()
        if not user_school or application.school != user_school:
            return Response({"detail": "You can only enroll applications from your own school."},
                            status=status.HTTP_403_FORBIDDEN)

        if application.status not in [Application.Status.ACCEPTED, Application.Status.ENROLLED]:
            return Response({"detail": "Only ACCEPTED applications can be enrolled."}, status=400)

        if application.student:
            return Response({"detail": "Already enrolled."}, status=400)

        # Build wizard_data from request.data while preserving repeated form fields
        # such as selected_optional_items submitted via multipart/form-data.
        wizard_data = {}

        # Safe boolean conversion helper
        def to_bool(val):
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() in ('true', '1', 'yes', 'on')
            if isinstance(val, (int, float)):
                return bool(val)
            return False

        if hasattr(request.data, 'lists'):
            for key, values in request.data.lists():
                if len(values) == 1:
                    wizard_data[key] = values[0]
                else:
                    wizard_data[key] = values
        else:
            wizard_data = {k: v for k, v in request.data.items()}

        # Convert common booleans
        for bool_field in ['is_waived', 'terms_accepted', 'summary_confirmed', 'auto_generate_admission']:
            if bool_field in wizard_data:
                wizard_data[bool_field] = to_bool(wizard_data[bool_field])

        # Ensure selected optional items are always a list of IDs
        if 'selected_optional_items' in wizard_data:
            values = wizard_data['selected_optional_items']
            if isinstance(values, str):
                try:
                    wizard_data['selected_optional_items'] = [int(x) for x in values.split(',') if x.strip()]
                except Exception:
                    wizard_data['selected_optional_items'] = []
            elif isinstance(values, list):
                wizard_data['selected_optional_items'] = [int(x) for x in values if str(x).strip()]
            else:
                wizard_data['selected_optional_items'] = []

        # Parse item-level deposit allocations from form data
        if 'item_amounts' in wizard_data:
            values = wizard_data['item_amounts']
            if isinstance(values, str):
                try:
                    import json
                    values = json.loads(values)
                except Exception:
                    values = {}
            if isinstance(values, dict):
                parsed = {}
                for key, value in values.items():
                    try:
                        parsed[str(key)] = str(value)
                    except Exception:
                        parsed[str(key)] = "0"
                wizard_data['item_amounts'] = parsed
            else:
                wizard_data['item_amounts'] = {}

        # Smart admission fee validation
        try:
            initial_payment = Decimal(str(wizard_data.get('initial_payment_amount', 0)))
            is_waived = wizard_data.get('is_waived', False)
            waiver_amount = Decimal(str(wizard_data.get('waiver_amount', 0)))
        except:
            initial_payment = Decimal('0')
            is_waived = False
            waiver_amount = Decimal('0')

        # Calculate net admission due based on fee structure
        admission_due = Decimal('3500')  # Default fallback
        if wizard_data.get('fee_structure'):
            try:
                from apps.finance.models import FeeStructure
                fee_structure = FeeStructure.objects.get(pk=wizard_data.get('fee_structure'))
                admission_due = Decimal(str(fee_structure.total_amount))
            except (FeeStructure.DoesNotExist, ValueError, TypeError):
                pass

        net_admission_due = max(Decimal('0'), admission_due - waiver_amount)

        # Smart logic:
        # - If waived → allow even with 0 initial payment
        # - If not waived → require some payment
        if net_admission_due > 0 and initial_payment <= 0 and not is_waived:
            return Response({
                "detail": "Payment towards admission/registration fee is required before enrollment.",
                "admission_due": float(net_admission_due)
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment_status = "NO"
            payment_amount = Decimal('0')

            # Record the initial payment if any
            # if initial_payment > 0:
            #     payment_amount = initial_payment
            #     payment_status = "PARTIAL"
            #     if initial_payment >= net_admission_due:
            #         payment_status = "FULL"

            #     AdmissionFeePayment.objects.create(
            #         application=application,
            #         amount=initial_payment,
            #         payment_method="Initial Enrollment Payment",
            #         receipt_number=wizard_data.get('initial_payment_reference', '')
            #     )

            # Enroll the student
            student = application.enroll_as_student(
                created_by_user=request.user,
                wizard_data=wizard_data
            )

            return Response({
                "detail": "Student enrolled successfully",
                "student_id": str(student.id),
                "id": str(student.id),
                "admission_number": student.admission_number,
                "student_name": student.full_name,
                "full_name": student.full_name,
                "payment_status": payment_status,
                "payment_amount": float(payment_amount),
                "amount_due": float(net_admission_due),
            }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
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
        return self.queryset.filter(application__school__in=self.request.user.schools.all())


class AdmissionFeePaymentViewSet(viewsets.ModelViewSet):
    queryset = AdmissionFeePayment.objects.all()
    serializer_class = AdmissionFeePaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['application', 'application__student', 'payment_method', 'receipt_number']

    def get_queryset(self):
        return self.queryset.filter(application__school__in=self.request.user.schools.all())

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        payment = self.get_object()
        application = payment.application
        applicant_name = f"{application.first_name} {application.middle_name or ''} {application.last_name or ''}".strip()
        student_name = application.student.full_name if getattr(application, 'student', None) else None
        return Response({
            'payment_id': str(payment.id),
            'receipt_number': payment.receipt_number,
            'amount': float(payment.amount),
            'payment_method': payment.payment_method,
            'payment_date': payment.payment_date,
            'application_id': str(application.id),
            'applicant_name': applicant_name,
            'student_name': student_name,
            'admission_number': application.admission_number,
        })