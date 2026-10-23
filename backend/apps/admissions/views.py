# admissions/views.py
from rest_framework import viewsets, status
from decimal import Decimal
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from .models import Application, ApplicationDocument, AdmissionFeePayment, ApplicationCharge
from .serializers import (
    ApplicationSerializer,
    ApplicationCreateUpdateSerializer,
    ApplicationDocumentSerializer,
    AdmissionFeePaymentSerializer,
    ApplicationListSerializer
)
from apps.school.models import School
from apps.school.support import accessible_school_ids, selected_school
from django.utils import timezone



def _ensure_application_charges(application):
    """Create INTERVIEW/ADMISSION charges from school defaults without overwriting staff edits."""
    from decimal import Decimal
    from .models import ApplicationCharge
    school = application.school
    specs = [
        (
            ApplicationCharge.ChargeType.INTERVIEW,
            bool(getattr(school, "interview_fee_enabled", False)),
            Decimal(str(getattr(school, "interview_fee_amount", 0) or 0)),
        ),
        (
            ApplicationCharge.ChargeType.ADMISSION,
            Decimal(str(getattr(school, "admission_fee_amount", 0) or 0)) > 0,
            Decimal(str(getattr(school, "admission_fee_amount", 0) or 0)),
        ),
    ]
    for charge_type, enabled, amount in specs:
        list_amt = amount if enabled else Decimal("0")
        if charge_type == ApplicationCharge.ChargeType.INTERVIEW and amount > 0:
            list_amt = amount
            enabled = True
        charge, created = ApplicationCharge.objects.get_or_create(
            application=application,
            charge_type=charge_type,
            defaults={
                "policy": (
                    ApplicationCharge.Policy.FULL
                    if enabled and list_amt > 0
                    else ApplicationCharge.Policy.NOT_APPLICABLE
                ),
                "list_amount": list_amt,
                "amount_due": list_amt if enabled and list_amt > 0 else Decimal("0"),
                "decision_made": False,
            },
        )
        if not created and not charge.decision_made:
            charge.list_amount = list_amt
            if list_amt > 0 and charge.policy == ApplicationCharge.Policy.NOT_APPLICABLE:
                charge.policy = ApplicationCharge.Policy.FULL
            charge.recompute_due()
            charge.save(update_fields=["list_amount", "policy", "amount_due", "updated_at"])


class ApplicationViewSet(viewsets.ModelViewSet):
    """
    Main ViewSet for school staff/admins - full CRUD + enrollment
    """
    queryset = Application.objects.prefetch_related('documents', 'fee_payments', 'charges').select_related('class_applied', 'school')
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

        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))
    
    def get_serializer_class(self):
        if self.action in ['list']:
            return ApplicationListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return ApplicationCreateUpdateSerializer
        return ApplicationSerializer


    def perform_create(self, serializer):
        # Prefer header/context school; fall back to body "school" if present
        school = None
        try:
            school = selected_school(self.request)
        except Exception:
            school = None
        if school is None:
            body_school = serializer.validated_data.get("school") or self.request.data.get("school")
            if body_school:
                from apps.school.models import School
                sid = getattr(body_school, "id", body_school)
                school = School.objects.filter(pk=sid).first()
        if school is None:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"school": "No school selected. Choose a school in the header switcher and try again."}
            )
        class_applied = serializer.validated_data.get("class_applied")
        if class_applied and class_applied.school_id != school.id:
            raise PermissionDenied("The selected class does not belong to this school.")
        # Drop client school so save uses resolved tenant
        serializer.validated_data.pop("school", None)
        application = serializer.save(school=school, created_by=self.request.user)
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
        school = selected_school(self.request)
        class_applied = serializer.validated_data.get("class_applied")
        if class_applied and class_applied.school_id != school.id:
            raise PermissionDenied("The selected class does not belong to this school.")
        new_status = serializer.validated_data.get('status')

        if new_status:
            new_status = str(new_status).upper()
            from rest_framework.exceptions import ValidationError
            if new_status == Application.Status.ENROLLED:
                raise ValidationError(
                    {"status": "Cannot set ENROLLED via update. Use the Enroll action after ACCEPTED."}
                )
            if not hasattr(instance, "can_transition_to"):
                raise ValidationError({"status": "Server misconfiguration: transitions unavailable."})
            if not instance.can_transition_to(new_status):
                raise ValidationError(
                    {
                        "status": (
                            f"Invalid transition from {instance.status} to {new_status}. "
                            "Follow: Submitted → Under Review → Offered → Accepted → Enroll."
                        )
                    }
                )

        application = serializer.save(school=school)
        # Seed interview/admission charges when pipeline reaches those stages
        if new_status in (
            Application.Status.TEST_SCHEDULED,
            getattr(Application.Status, "INTERVIEW_COMPLETED", "INTERVIEW_COMPLETED"),
            Application.Status.OFFERED,
            Application.Status.ACCEPTED,
        ):
            try:
                _ensure_application_charges(application)
            except Exception as exc:
                print(f"[charges] ensure failed: {exc}")
        # Timestamps (save() on model also handles these; set explicitly for clarity)
        if new_status:
            update_fields = []
            if new_status == Application.Status.OFFERED and not application.offer_issued_at:
                application.offer_issued_at = timezone.now()
                update_fields.append("offer_issued_at")
            if new_status == Application.Status.ACCEPTED and not application.accepted_at:
                application.accepted_at = timezone.now()
                update_fields.append("accepted_at")
            if update_fields:
                application.save(update_fields=update_fields)

        
    
    @action(detail=True, methods=["post"], url_path="ensure-charges")
    def ensure_charges(self, request, pk=None):
        """
        Create/sync INTERVIEW + ADMISSION charges from school defaults.
        Existing apps get N/A when school amounts are 0 / interview disabled.
        """
        from decimal import Decimal
        application = self.get_object()
        school = application.school
        created = []

        specs = [
            (
                ApplicationCharge.ChargeType.INTERVIEW,
                bool(getattr(school, "interview_fee_enabled", False)),
                Decimal(str(getattr(school, "interview_fee_amount", 0) or 0)),
            ),
            (
                ApplicationCharge.ChargeType.ADMISSION,
                Decimal(str(getattr(school, "admission_fee_amount", 0) or 0)) > 0,
                Decimal(str(getattr(school, "admission_fee_amount", 0) or 0)),
            ),
        ]

        for charge_type, enabled, amount in specs:
            list_amt = amount if enabled else Decimal("0")
            # If interview amount set but toggle off, still expose the amount so staff can decide
            if charge_type == ApplicationCharge.ChargeType.INTERVIEW and amount > 0:
                list_amt = amount
                enabled = True
            charge, was_created = ApplicationCharge.objects.get_or_create(
                application=application,
                charge_type=charge_type,
                defaults={
                    "policy": (
                        ApplicationCharge.Policy.FULL
                        if enabled and list_amt > 0
                        else ApplicationCharge.Policy.NOT_APPLICABLE
                    ),
                    "list_amount": list_amt,
                    "amount_due": list_amt if enabled and list_amt > 0 else Decimal("0"),
                    "decision_made": False,
                },
            )
            if was_created:
                created.append(charge_type)
            else:
                # Sync list price from school settings until staff has decided
                if not charge.decision_made:
                    charge.list_amount = list_amt
                    if list_amt > 0 and charge.policy == ApplicationCharge.Policy.NOT_APPLICABLE:
                        # Prefer FULL as suggested default when school has a price
                        charge.policy = ApplicationCharge.Policy.FULL
                    charge.recompute_due()
                    charge.save(
                        update_fields=[
                            "list_amount",
                            "policy",
                            "amount_due",
                            "updated_at",
                        ]
                    )
        from .serializers import ApplicationChargeSerializer
        qs = application.charges.all()
        return Response(
            {
                "created": created,
                "charges": ApplicationChargeSerializer(qs, many=True).data,
            }
        )

    @action(detail=True, methods=["patch"], url_path="charges/(?P<charge_type>[^/.]+)")
    def update_charge(self, request, pk=None, charge_type=None):
        from decimal import Decimal
        application = self.get_object()
        charge = application.charges.filter(charge_type=str(charge_type).upper()).first()
        if not charge:
            return Response({"detail": "Charge not found. Call ensure-charges first."}, status=404)

        policy = request.data.get("policy", charge.policy)
        charge.policy = policy
        charge.decision_made = True
        if "list_amount" in request.data:
            charge.list_amount = Decimal(str(request.data.get("list_amount") or 0))
        if "discount_amount" in request.data:
            charge.discount_amount = Decimal(str(request.data.get("discount_amount") or 0))
        if "amount_paid" in request.data:
            charge.amount_paid = Decimal(str(request.data.get("amount_paid") or 0))
        if "waiver_reason" in request.data:
            charge.waiver_reason = str(request.data.get("waiver_reason") or "")
        if "notes" in request.data:
            charge.notes = str(request.data.get("notes") or "")
        charge.recompute_due()
        charge.save()
        try:
            from apps.finance.pre_enrollment import post_charge_to_finance
            post_charge_to_finance(charge, student=getattr(application, "student", None))
        except Exception as exc:
            print(f"[finance] post_charge_to_finance: {exc}")
        from .serializers import ApplicationChargeSerializer
        return Response(ApplicationChargeSerializer(charge).data)


    @action(detail=True, methods=['post'], url_path='enroll')
    @transaction.atomic
    def enroll(self, request, pk=None):
        """
        Enroll an accepted application as a Student with smart admission fee handling
        """
        application = self.get_object()

        # School permission check
        user_school = selected_school(request)
        if application.school_id != user_school.id:
            return Response({"detail": "You can only enroll applications from your own school."},
                            status=status.HTTP_403_FORBIDDEN)

        allowed = {
            Application.Status.ACCEPTED,
            Application.Status.ENROLLED,
            getattr(Application.Status, "OFFERED", "OFFERED"),
        }
        if application.status not in allowed:
            return Response(
                {
                    "detail": (
                        f"Cannot enroll while status is {application.status}. "
                        "Move the application to Accepted (or Offered) first."
                    ),
                    "status": application.status,
                },
                status=400,
            )

        if application.student:
            return Response({"detail": "Already enrolled."}, status=400)

        # Optional: block enroll until admission charge satisfied
        school = application.school
        if getattr(school, "require_admission_fee_before_enroll", False):
            from .models import ApplicationCharge
            adm = application.charges.filter(
                charge_type=ApplicationCharge.ChargeType.ADMISSION
            ).first()
            if adm and not adm.is_satisfied:
                return Response(
                    {
                        "detail": "Admission fee is not satisfied (pay, waive, or mark N/A before enroll).",
                        "charge": {
                            "policy": adm.policy,
                            "amount_due": str(adm.amount_due),
                            "amount_paid": str(adm.amount_paid),
                        },
                    },
                    status=400,
                )


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
        if False and net_admission_due > 0 and initial_payment <= 0 and not is_waived:
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
            try:
                student = application.enroll_as_student(
                    created_by_user=request.user,
                    wizard_data=wizard_data,
                )
            except Exception as exc:
                import traceback
                traceback.print_exc()
                msg = str(exc) or exc.__class__.__name__
                return Response(
                    {"detail": f"Enrollment failed: {msg}"},
                    status=status.HTTP_400_BAD_REQUEST,
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


    @action(detail=False, methods=["get"], url_path="pipeline-stats")
    def pipeline_stats(self, request):
        """Admissions funnel + fee metrics for the active school."""
        from django.db.models import Count, Sum
        from .models import ApplicationCharge

        qs = self.get_queryset()
        by_status = {
            row["status"]: row["c"]
            for row in qs.values("status").annotate(c=Count("id"))
        }
        charges = ApplicationCharge.objects.filter(application__in=qs)
        interview_paid = (
            charges.filter(charge_type="INTERVIEW", amount_paid__gt=0).aggregate(
                t=Sum("amount_paid")
            )["t"]
            or 0
        )
        admission_paid = (
            charges.filter(charge_type="ADMISSION", amount_paid__gt=0).aggregate(
                t=Sum("amount_paid")
            )["t"]
            or 0
        )
        waitlist = qs.filter(interview_outcome="WAITLIST").count()
        failed = qs.filter(interview_outcome="FAIL").count()
        return Response(
            {
                "by_status": by_status,
                "total": qs.count(),
                "waitlist": waitlist,
                "interview_failed": failed,
                "interview_fees_collected": str(interview_paid),
                "admission_fees_collected": str(admission_paid),
            }
        )


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

    @action(detail=True, methods=["get"], url_path="document-checklist")
    def document_checklist(self, request, pk=None):
        """Required documents vs uploaded for an application."""
        app = self.get_object()
        required = [
            {"key": "photo", "label": "Student photo", "required": True},
            {"key": "birth_cert", "label": "Birth certificate", "required": True},
            {"key": "report", "label": "Previous school report", "required": False},
            {"key": "guardian_id", "label": "Guardian ID copy", "required": False},
        ]
        docs = list(app.documents.all())
        desc = " ".join((d.description or "").lower() for d in docs)
        uploaded = {
            "photo": bool(app.photo) or "photo" in desc,
            "birth_cert": "birth" in desc or "certificate" in desc,
            "report": "report" in desc or "transcript" in desc,
            "guardian_id": "id" in desc or "passport" in desc or "national" in desc,
        }
        items = []
        for r in required:
            ok = uploaded.get(r["key"], False)
            items.append({**r, "uploaded": ok, "satisfied": ok or not r["required"]})
        return Response(
            {
                "items": items,
                "all_required_met": all(i["satisfied"] for i in items if i["required"]),
                "document_count": len(docs),
            }
        )


class ApplicationDocumentViewSet(viewsets.ModelViewSet):
    queryset = ApplicationDocument.objects.all()
    serializer_class = ApplicationDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(
            application__school_id__in=accessible_school_ids(self.request)
        )


class AdmissionFeePaymentViewSet(viewsets.ModelViewSet):
    queryset = AdmissionFeePayment.objects.all()
    serializer_class = AdmissionFeePaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['application', 'application__student', 'payment_method', 'receipt_number']

    def get_queryset(self):
        return self.queryset.filter(
            application__school_id__in=accessible_school_ids(self.request)
        )

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