from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from uuid import UUID
from .models import School, Module, SchoolSupportAuditLog, SchoolSupportSession
from .serializers import (
    SchoolSerializer,
    SchoolCreateUpdateSerializer,
    ModuleSerializer,
    SchoolMiniSerializer,
    SchoolSessionSerializer,
    PlatformSchoolSerializer,
)
from .module_seed import seed_default_modules
from apps.core.permissions import IsAssociatedWithSchool
from .permissions import IsPlatformSuperuser
from .support import active_support_session, accessible_school_ids, close_support_sessions, selected_school

class ModuleViewSet(ModelViewSet):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get']  # read-only is perfect

    def get_queryset(self):
        seed_default_modules()
        return Module.objects.all()


class SchoolViewSet(ModelViewSet):
    """
    Manage schools with multi-tenancy enforcement.
    """
    queryset = School.objects.prefetch_related('modules').all().order_by('name')
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get_permissions(self):
        if self.action in {"platform_directory", "start_support_context", "end_support_context", "support_context"}:
            return [IsAuthenticated(), IsPlatformSuperuser()]
        return super().get_permissions()

    def get_queryset(self):
        return self.queryset.filter(pk__in=accessible_school_ids(self.request))

    def get_serializer_class(self):
        if self.action == "platform_directory":
            return PlatformSchoolSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return SchoolCreateUpdateSerializer
        return SchoolSerializer
   
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        """
        Create a new school and automatically associate the current user.
        """
        if self.request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Platform administrators cannot create schools through onboarding.")
        school = serializer.save(owner=self.request.user)
        school.users.add(self.request.user)
        return school
        
    
    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        school = self.get_queryset().order_by('-updated_at', '-created_at').first()

        if not school:
            return Response({"detail": "No active school found."}, status=404)
    
    # Use Mini serializer for consistency (smaller payload + logo)
        serializer = SchoolMiniSerializer(school)
        return Response(serializer.data)
    @action(detail=False, methods=['get'], url_path='my-schools',
            permission_classes=[IsAuthenticated])
    def my_schools(self, request):
        if request.user.is_superuser:
            schools = self.get_queryset()
        else:
            schools = School.objects.filter(
                Q(owner=request.user) | Q(users=request.user)
            ).distinct().order_by('name')
        schools = schools.prefetch_related("modules")
        serializer = SchoolSessionSerializer(schools, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="platform-directory")
    def platform_directory(self, request):
        schools = School.objects.all().order_by("name")
        search = request.query_params.get("search", "").strip()
        if search:
            schools = schools.filter(
                Q(name__icontains=search)
                | Q(short_name__icontains=search)
                | Q(email__icontains=search)
                | Q(city__icontains=search)
                | Q(country__icontains=search)
            )
        return Response(PlatformSchoolSerializer(schools, many=True).data)

    @action(detail=False, methods=["post"], url_path="start-support-context")
    def start_support_context(self, request):
        school_id = request.data.get("school_id")
        reason = request.data.get("reason")
        if not school_id:
            return Response({"detail": "school_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            school_id = UUID(str(school_id))
        except (TypeError, ValueError):
            return Response({"detail": "school_id must be a valid UUID."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(reason, str) or not reason.strip():
            return Response({"detail": "A support reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        reason = reason.strip()
        school = get_object_or_404(School, pk=school_id)

        with transaction.atomic():
            type(request.user).objects.select_for_update().get(pk=request.user.pk)
            close_support_sessions(request.user, action="context_switched")
            support_session = SchoolSupportSession.objects.create(
                administrator=request.user,
                school=school,
                reason=reason[:500],
            )
            SchoolSupportAuditLog.objects.create(
                administrator=request.user,
                school=school,
                support_session=support_session,
                action="context_started",
            )
        return Response({
            "id": str(support_session.id),
            "school": PlatformSchoolSerializer(school).data,
            "started_at": support_session.started_at,
            "read_only": True,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="end-support-context")
    def end_support_context(self, request):
        support_session = active_support_session(request.user)
        if support_session:
            support_session.ended_at = timezone.now()
            support_session.save(update_fields=["ended_at"])
            SchoolSupportAuditLog.objects.create(
                administrator=request.user,
                school=support_session.school,
                support_session=support_session,
                action="context_ended",
            )
        return Response({"detail": "School-support context ended."})

    @action(detail=False, methods=["get"], url_path="support-context")
    def support_context(self, request):
        support_session = active_support_session(request.user)
        if not support_session:
            return Response({"active": False, "school": None})
        return Response({
            "active": True,
            "id": str(support_session.id),
            "school": PlatformSchoolSerializer(support_session.school).data,
            "started_at": support_session.started_at,
            "read_only": True,
        })


    @action(detail=False, methods=["get"], url_path="pulse")
    def pulse(self, request):
        """
        Owner decision pulse — live KPIs for the selected school.
        One request powers the dashboard instead of many module digs.
        """
        from django.utils import timezone
        from django.db.models import Sum, Count, Q
        from decimal import Decimal
        from apps.students.models import Student
        from apps.academics.models import AcademicYear, Term, GradeLevel, Section, Subject, Curriculum
        from apps.admissions.models import Application

        school = selected_school(request)
        today = timezone.now().date()
        month_start = today.replace(day=1)

        # Students
        students_qs = Student.objects.filter(school=school)
        students_active = students_qs.filter(status="ACTIVE").count()
        students_total = students_qs.count()
        by_class = list(
            students_qs.filter(status="ACTIVE", current_class__isnull=False)
            .values("current_class__name")
            .annotate(count=Count("id"))
            .order_by("current_class__order", "current_class__name")[:12]
        )

        # Admissions pipeline
        apps = Application.objects.filter(school=school)
        admissions = {
            "draft": apps.filter(status="DRAFT").count(),
            "submitted": apps.filter(status="SUBMITTED").count(),
            "under_review": apps.filter(status="UNDER_REVIEW").count(),
            "accepted": apps.filter(status="ACCEPTED").count(),
            "enrolled": apps.filter(status="ENROLLED").count(),
            "this_month": apps.filter(submitted_at__gte=month_start).count() if hasattr(Application, "submitted_at") else apps.filter(created_at__gte=month_start).count() if hasattr(Application, "created_at") else 0,
        }

        # Finance (best-effort) — term fees + pre-enrollment admission/interview
        finance = {
            "outstanding": "0.00",
            "collected_month": "0.00",
            "collected_fees_month": "0.00",
            "collected_admission_month": "0.00",
            "collected_interview_month": "0.00",
            "collected_admission_total": "0.00",
            "collected_interview_total": "0.00",
            "collected_fees_total": "0.00",
            "overdue_invoices": 0,
            "invoices_unpaid": 0,
        }
        try:
            from apps.finance.models import Invoice, Payment
            from apps.admissions.models import ApplicationCharge, AdmissionFeePayment
            from django.utils import timezone as dj_tz

            inv = Invoice.objects.filter(Q(school=school) | Q(student__school=school))
            outstanding = inv.filter(is_paid=False).aggregate(t=Sum("balance"))["t"] or Decimal("0")
            overdue = inv.filter(is_paid=False, due_date__lt=today).count()
            unpaid = inv.filter(is_paid=False).count()

            pay_qs = Payment.objects.filter(
                Q(school=school) | Q(invoice__student__school=school) | Q(invoice__school=school)
            )
            collected_fees_month = (
                pay_qs.filter(paid_at__gte=month_start).aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            collected_fees_total = pay_qs.aggregate(t=Sum("amount"))["t"] or Decimal("0")

            # ApplicationCharge.amount_paid (interview / admission pipeline)
            charges = ApplicationCharge.objects.filter(application__school=school)
            interview_total = (
                charges.filter(charge_type=ApplicationCharge.ChargeType.INTERVIEW)
                .aggregate(t=Sum("amount_paid"))["t"]
                or Decimal("0")
            )
            admission_from_charges = (
                charges.filter(charge_type=ApplicationCharge.ChargeType.ADMISSION)
                .aggregate(t=Sum("amount_paid"))["t"]
                or Decimal("0")
            )
            # Month window on charge updates (best available timestamp)
            interview_month = (
                charges.filter(
                    charge_type=ApplicationCharge.ChargeType.INTERVIEW,
                    updated_at__gte=month_start,
                    amount_paid__gt=0,
                ).aggregate(t=Sum("amount_paid"))["t"]
                or Decimal("0")
            )
            admission_charges_month = (
                charges.filter(
                    charge_type=ApplicationCharge.ChargeType.ADMISSION,
                    updated_at__gte=month_start,
                    amount_paid__gt=0,
                ).aggregate(t=Sum("amount_paid"))["t"]
                or Decimal("0")
            )

            # Legacy AdmissionFeePayment rows
            adm_pay = AdmissionFeePayment.objects.filter(application__school=school)
            admission_legacy_total = adm_pay.aggregate(t=Sum("amount"))["t"] or Decimal("0")
            admission_legacy_month = (
                adm_pay.filter(payment_date__gte=month_start).aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )

            admission_total = admission_from_charges + admission_legacy_total
            admission_month = admission_charges_month + admission_legacy_month

            collected_month = collected_fees_month + admission_month + interview_month

            billed = inv.aggregate(t=Sum("amount_due"))["t"] or Decimal("0")
            paid_total = inv.aggregate(t=Sum("amount_paid"))["t"] or Decimal("0")
            collection_rate = float((paid_total / billed * 100) if billed > 0 else 0)
            overdue_balance = (
                inv.filter(is_paid=False, due_date__lt=today).aggregate(t=Sum("balance"))["t"]
                or Decimal("0")
            )
            finance = {
                "outstanding": f"{outstanding:.2f}",
                "collected_month": f"{collected_month:.2f}",
                "collected_fees_month": f"{collected_fees_month:.2f}",
                "collected_admission_month": f"{admission_month:.2f}",
                "collected_interview_month": f"{interview_month:.2f}",
                "collected_fees_total": f"{collected_fees_total:.2f}",
                "collected_admission_total": f"{admission_total:.2f}",
                "collected_interview_total": f"{interview_total:.2f}",
                "overdue_invoices": overdue,
                "invoices_unpaid": unpaid,
                "billed": f"{billed:.2f}",
                "collected_total": f"{(collected_fees_total + admission_total + interview_total):.2f}",
                "collection_rate": round(collection_rate, 1),
                "overdue_balance": f"{overdue_balance:.2f}",
            }
        except Exception as exc:
            print(f"[pulse] finance breakdown failed: {exc}")

        # Academics structure
        years = AcademicYear.objects.filter(school=school)
        active_year = years.filter(is_active=True).first()
        current_term = None
        if active_year:
            current_term = (
                Term.objects.filter(academic_year=active_year, start_date__lte=today, end_date__gte=today)
                .order_by("order")
                .first()
            )
        grades = GradeLevel.objects.filter(school=school)
        sections = Section.objects.filter(grade_level__school=school, is_active=True)
        subjects = Subject.objects.filter(school=school, is_active=True)
        curricula = Curriculum.objects.filter(school=school, is_active=True)

        # Readiness score (unique ERP angle) — setup completeness 0-100
        checks = [
            curricula.exists(),
            grades.exists(),
            sections.exists(),
            years.exists(),
            active_year is not None,
            subjects.exists(),
            students_active > 0,
        ]
        score = int(round(100 * sum(1 for c in checks if c) / len(checks)))
        gaps = []
        if not curricula.exists():
            gaps.append({"code": "curriculum", "label": "Add a curriculum", "href": "/dashboard/modules/academics"})
        if not grades.exists():
            gaps.append({"code": "grades", "label": "Define grade levels", "href": "/dashboard/modules/academics"})
        if not sections.exists():
            gaps.append({"code": "sections", "label": "Create class sections", "href": "/dashboard/modules/academics"})
        if not active_year:
            gaps.append({"code": "year", "label": "Activate an academic year", "href": "/dashboard/modules/academics"})
        if not subjects.exists():
            gaps.append({"code": "subjects", "label": "Add subjects", "href": "/dashboard/modules/academics"})
        try:
            from apps.finance.models import FeeStructure
            if not FeeStructure.objects.filter(school=school).exists():
                gaps.append({"code": "finance", "label": "Set up fee structures", "href": "/dashboard/modules/finance/fee-structures"})
        except Exception:
            pass

        return Response({
            "school": {"id": str(school.id), "name": school.name, "currency_symbol": getattr(school, "currency_symbol", None) or school.currency},
            "as_of": today.isoformat(),
            "readiness_score": score,
            "gaps": gaps,
            "students": {
                "active": students_active,
                "total": students_total,
                "by_class": [
                    {"name": r["current_class__name"], "count": r["count"]} for r in by_class
                ],
            },
            "admissions": admissions,
            "finance": finance,
            "academics": {
                "curricula": curricula.count(),
                "grade_levels": grades.count(),
                "sections": sections.count(),
                "subjects": subjects.count(),
                "academic_years": years.count(),
                "active_year": AcademicYearSerializerLite(active_year) if active_year else None,
                "current_term": {
                    "id": current_term.id,
                    "name": current_term.name,
                    "start_date": current_term.start_date,
                    "end_date": current_term.end_date,
                } if current_term else None,
            },
        })


def AcademicYearSerializerLite(year):
    if not year:
        return None
    return {
        "id": year.id,
        "name": year.name,
        "start_date": year.start_date,
        "end_date": year.end_date,
        "is_active": year.is_active,
    }
