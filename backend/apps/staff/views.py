from decimal import Decimal
from datetime import date

from django.db.models import Q, Sum, Count
from django.utils import timezone
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.school.support import accessible_school_ids, selected_school
from .models import Staff, Payroll, LeaveRequest
from .serializers import (
    StaffSerializer,
    StaffWriteSerializer,
    PayrollSerializer,
    PayrollCreateUpdateSerializer,
    LeaveRequestSerializer,
)


class StaffViewSet(ModelViewSet):
    queryset = Staff.objects.select_related("user").all()
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = self.queryset.filter(school_id__in=accessible_school_ids(self.request))
        role = self.request.query_params.get("role")
        active = self.request.query_params.get("is_active")
        q = self.request.query_params.get("q") or self.request.query_params.get("search")
        if role:
            qs = qs.filter(role=role.upper())
        if active is not None and active != "":
            qs = qs.filter(is_active=str(active).lower() in ("1", "true", "yes"))
        if q:
            qs = qs.filter(
                Q(user__first_name__icontains=q)
                | Q(user__last_name__icontains=q)
                | Q(user__email__icontains=q)
                | Q(phone__icontains=q)
                | Q(employee_number__icontains=q)
                | Q(department__icontains=q)
                | Q(job_title__icontains=q)
                | Q(national_id__icontains=q)
                | Q(tsc_number__icontains=q)
            )
        return qs.order_by("user__last_name", "user__first_name", "user__email")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return StaffWriteSerializer
        return StaffSerializer

    def create(self, request, *args, **kwargs):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        ser = StaffWriteSerializer(
            data=request.data, context={"school": school, "request": request}
        )
        ser.is_valid(raise_exception=True)
        staff = ser.save()
        return Response(StaffSerializer(staff).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        school = selected_school(request)
        ser = StaffWriteSerializer(
            instance,
            data=request.data,
            partial=partial,
            context={"school": school, "request": request},
        )
        ser.is_valid(raise_exception=True)
        staff = ser.save()
        return Response(StaffSerializer(staff).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="sync-teachers")
    def sync_teachers(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        from apps.accounts.models import User

        users = school.users.filter(role=User.Role.TEACHER)
        created = 0
        existing = 0
        for user in users:
            obj, was_created = Staff.objects.get_or_create(
                user=user,
                defaults={
                    "school": school,
                    "role": Staff.Role.TEACHER,
                    "hire_date": date.today(),
                    "is_active": True,
                },
            )
            if not was_created:
                existing += 1
                if obj.school_id != school.id:
                    obj.school = school
                    obj.save(update_fields=["school"])
            else:
                created += 1
        return Response({"created": created, "existing": existing})

    @action(detail=False, methods=["get"], url_path="teachers")
    def teachers(self, request):
        qs = self.get_queryset().filter(role=Staff.Role.TEACHER, is_active=True)
        return Response(StaffSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        by_role = {role: qs.filter(role=role).count() for role, _ in Staff.Role.choices}
        on_leave = (
            LeaveRequest.objects.filter(
                school_id__in=accessible_school_ids(request),
                status=LeaveRequest.Status.APPROVED,
                start_date__lte=date.today(),
                end_date__gte=date.today(),
            )
            .values("staff_id")
            .distinct()
            .count()
        )
        return Response(
            {
                "total": qs.count(),
                "active": qs.filter(is_active=True).count(),
                "teachers": qs.filter(role=Staff.Role.TEACHER, is_active=True).count(),
                "on_leave_today": on_leave,
                "by_role": by_role,
            }
        )

    @action(detail=True, methods=["get"], url_path="teaching-load")
    def teaching_load(self, request, pk=None):
        staff = self.get_object()
        from apps.academics.models import SubjectTeacher, Section
        from apps.academics.serializers import SubjectTeacherSerializer, SectionSerializer

        assigns = (
            SubjectTeacher.objects.filter(teacher=staff, is_active=True)
            .select_related("subject", "grade_level", "academic_year")
            .order_by("academic_year__name", "grade_level__order", "subject__name")
        )
        sections = (
            Section.objects.filter(class_teacher=staff, is_active=True)
            .select_related("grade_level", "class_teacher", "class_teacher__user")
            .order_by("grade_level__order", "name")
        )
        return Response(
            {
                "staff_id": str(staff.id),
                "subject_assignments": SubjectTeacherSerializer(assigns, many=True).data,
                "class_sections": SectionSerializer(sections, many=True).data,
            }
        )


class PayrollViewSet(ModelViewSet):
    queryset = Payroll.objects.select_related("staff__user").all().order_by("-month")
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = self.queryset.filter(staff__school_id__in=accessible_school_ids(self.request))
        staff_id = self.request.query_params.get("staff")
        month = self.request.query_params.get("month")
        status = self.request.query_params.get("status")
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        if month:
            qs = qs.filter(month__startswith=str(month)[:7])
        if status:
            qs = qs.filter(status=status.upper())
        return qs

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if not school:
            raise ValidationError({"detail": "No school selected"})
        if serializer.validated_data["staff"].school_id != school.id:
            raise PermissionDenied("Payroll must belong to the selected school's staff.")
        serializer.save()

    def perform_update(self, serializer):
        school = selected_school(self.request)
        staff = serializer.validated_data.get("staff", serializer.instance.staff)
        if staff.school_id != school.id:
            raise PermissionDenied("Payroll must belong to the selected school's staff.")
        serializer.save()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return PayrollCreateUpdateSerializer
        return PayrollSerializer

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        month = request.query_params.get("month")
        if month:
            qs = qs.filter(month__startswith=str(month)[:7])
        agg = qs.aggregate(
            total_net=Sum("net_salary"),
            total_basic=Sum("basic_salary"),
            count=Count("id"),
        )
        by_status = {
            s: qs.filter(status=s).count() for s, _ in Payroll.Status.choices
        }
        return Response({**agg, "by_status": by_status})

    def _pay_one(self, row, request):
        """Mark paid + post expense/GL. Returns (row, error_str|None)."""
        from apps.finance.ledger import post_payroll
        from apps.finance.models import Account, FeeCategory, ExpenseCategory

        if row.status == Payroll.Status.CANCELLED:
            return row, "cancelled"
        # Never double-pay / double-post
        if row.status == Payroll.Status.PAID and row.expense_id:
            return row, "already_paid"

        method = (request.data.get("payment_method") or row.payment_method or "BANK").upper()
        account_id = request.data.get("paid_from_account")
        account = None
        if account_id:
            account = Account.objects.filter(
                pk=account_id, school_id=row.staff.school_id
            ).first()

        # Per-staff / per-row categories win. Request body is only a fallback
        # when the payslip row has none set (never force one group on everyone).
        fee_cat_id = request.data.get("related_fee_category") or request.data.get("fee_category")
        exp_cat_id = request.data.get("expense_category")
        if not row.related_fee_category_id:
            if fee_cat_id:
                fc = FeeCategory.objects.filter(pk=fee_cat_id, school_id=row.staff.school_id).first()
                if fc:
                    row.related_fee_category = fc
            elif getattr(row.staff, "default_fee_category_id", None):
                row.related_fee_category_id = row.staff.default_fee_category_id
        if not row.expense_category_id:
            if exp_cat_id:
                ec = ExpenseCategory.objects.filter(pk=exp_cat_id, school_id=row.staff.school_id).first()
                if ec:
                    row.expense_category = ec
            elif getattr(row.staff, "default_expense_category_id", None):
                row.expense_category_id = row.staff.default_expense_category_id

        paid_at = request.data.get("paid_at") or date.today()
        if isinstance(paid_at, str) and len(paid_at) >= 10:
            from datetime import datetime
            try:
                paid_at = datetime.strptime(paid_at[:10], "%Y-%m-%d").date()
            except ValueError:
                paid_at = date.today()
        row.paid_at = paid_at
        row.payment_method = method
        if account:
            row.paid_from_account = account
        row.status = Payroll.Status.PAID
        row.save()
        try:
            post_payroll(
                row,
                payment_method=method,
                paid_from_account=account,
                user=request.user,
            )
            row.refresh_from_db()
        except Exception as e:
            return row, str(e)
        return row, None

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        row = self.get_object()
        row, err = self._pay_one(row, request)
        if err == "already_paid":
            return Response(
                {"detail": "Already paid — not posted again", "payroll": PayrollSerializer(row).data}
            )
        if err == "cancelled":
            return Response({"detail": "Cannot pay a cancelled row"}, status=400)
        if err:
            return Response(
                {"detail": f"Marked paid but GL post issue: {err}", "payroll": PayrollSerializer(row).data},
                status=200,
            )
        return Response(PayrollSerializer(row).data)

    def _generate_month_rows(self, school, prefix, request=None):
        """
        Create DRAFT payslips for active staff who do not yet have a row this month.
        Amounts/categories come from:
          1) Staff standing defaults (default_basic_salary, default_fee_category, …)
          2) Else last prior payroll row for that staff
          3) Else optional request body defaults (only when staff has no setting)
        """
        from calendar import monthrange
        from datetime import date as date_cls
        from apps.staff.models import Staff
        from apps.finance.models import FeeCategory, ExpenseCategory

        year, month = int(prefix[:4]), int(prefix[5:7])
        month_date = date_cls(year, month, 1)

        fallback_fee = None
        fallback_exp = None
        if request is not None:
            fid = request.data.get("related_fee_category") or request.data.get("fee_category")
            eid = request.data.get("expense_category")
            if fid:
                fallback_fee = FeeCategory.objects.filter(pk=fid, school=school).first()
            if eid:
                fallback_exp = ExpenseCategory.objects.filter(pk=eid, school=school).first()

        active = Staff.objects.filter(school=school, is_active=True).select_related(
            "user", "default_fee_category", "default_expense_category"
        )
        existing_staff_ids = set(
            self.get_queryset()
            .filter(staff__school=school, month__startswith=prefix)
            .values_list("staff_id", flat=True)
        )
        created = []
        for st in active:
            if st.id in existing_staff_ids:
                continue
            basic = Decimal(str(st.default_basic_salary or 0))
            allow = Decimal(str(st.default_allowances or 0))
            ded = Decimal(str(st.default_deductions or 0))
            fee_id = st.default_fee_category_id
            exp_id = st.default_expense_category_id

            if basic <= 0:
                prior = (
                    Payroll.objects.filter(staff=st)
                    .exclude(status=Payroll.Status.CANCELLED)
                    .order_by("-month", "-created_at")
                    .first()
                )
                if prior:
                    basic = Decimal(str(prior.basic_salary or 0))
                    allow = Decimal(str(prior.allowances or 0))
                    ded = Decimal(str(prior.deductions or 0))
                    if not fee_id:
                        fee_id = prior.related_fee_category_id
                    if not exp_id:
                        exp_id = prior.expense_category_id

            if basic <= 0:
                # Nothing to pay for this staff — skip
                continue

            if not fee_id and fallback_fee:
                fee_id = fallback_fee.id
            if not exp_id and fallback_exp:
                exp_id = fallback_exp.id

            row = Payroll.objects.create(
                staff=st,
                month=month_date,
                basic_salary=basic,
                allowances=allow,
                deductions=ded,
                status=Payroll.Status.DRAFT,
                related_fee_category_id=fee_id,
                expense_category_id=exp_id,
                notes=f"Auto-generated payslip for {prefix}",
            )
            created.append(row)
        return created

    @action(detail=False, methods=["post"], url_path="generate-month")
    def generate_month(self, request):
        """Create monthly payslips from standing salaries — does not mark paid."""
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        month_raw = request.data.get("month") or ""
        if not month_raw:
            return Response({"detail": "month is required (YYYY-MM)"}, status=400)
        prefix = str(month_raw)[:7]
        created = self._generate_month_rows(school, prefix, request)
        return Response(
            {
                "month": prefix,
                "created": len(created),
                "detail": (
                    f"Created {len(created)} payslip(s) for {prefix} from standing salaries. "
                    "Already-existing rows were left unchanged."
                ),
            },
            status=201 if created else 200,
        )

    @action(detail=False, methods=["post"], url_path="run")
    def run_payroll(self, request):
        """
        1) Auto-create missing payslips for the month from each staff's standing pay
           and per-staff fee/expense categories.
        2) Pay only unpaid rows (DRAFT/APPROVED) and post to Finance once each.
        Already PAID rows are never re-posted.
        Body defaults related_fee_category / expense_category apply only when a staff
        member has no per-person setting.
        """
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        month_raw = request.data.get("month") or ""
        if not month_raw:
            return Response({"detail": "month is required (YYYY-MM)"}, status=400)
        prefix = str(month_raw)[:7]

        generate = request.data.get("generate", True)
        created_n = 0
        if generate is not False and str(generate).lower() not in ("0", "false", "no"):
            created = self._generate_month_rows(school, prefix, request)
            created_n = len(created)

        qs = (
            self.get_queryset()
            .filter(
                staff__school=school,
                month__startswith=prefix,
                status__in=[Payroll.Status.DRAFT, Payroll.Status.APPROVED],
            )
            .select_related(
                "staff__user",
                "staff__school",
                "staff__default_fee_category",
                "staff__default_expense_category",
                "related_fee_category",
                "expense_category",
            )
        )
        pay_now = request.data.get("pay", True)
        paid = 0
        skipped = (
            self.get_queryset()
            .filter(staff__school=school, month__startswith=prefix, status=Payroll.Status.PAID)
            .count()
        )
        errors = []
        if pay_now is not False and str(pay_now).lower() not in ("0", "false", "no"):
            for row in qs:
                row, err = self._pay_one(row, request)
                if err in ("already_paid", "cancelled"):
                    skipped += 1
                    continue
                if err:
                    errors.append({"id": str(row.id), "staff": str(row.staff_id), "detail": err})
                else:
                    paid += 1
        return Response(
            {
                "month": prefix,
                "generated": created_n,
                "posted": paid,
                "skipped_already_paid": skipped,
                "errors": errors[:20],
                "error_count": len(errors),
            }
        )


    @action(detail=True, methods=["get"], url_path="payslip")
    def payslip(self, request, pk=None):
        """JSON payload for official payslip print."""
        row = self.get_object()
        school = row.staff.school
        u = row.staff.user
        name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
        return Response(
            {
                "document": "PAYSLIP",
                "school": {
                    "name": getattr(school, "name", "") or "",
                    "short_name": getattr(school, "short_name", "") or "",
                    "address": getattr(school, "address", "") or "",
                    "phone": getattr(school, "phone", "") or "",
                    "email": getattr(school, "email", "") or "",
                    "logo": getattr(school, "logo", None) and str(school.logo.url) if getattr(school, "logo", None) else None,
                },
                "employee": {
                    "name": name,
                    "email": u.email,
                    "role": row.staff.get_role_display(),
                    "department": row.staff.department or "",
                    "job_title": row.staff.job_title or "",
                    "employee_number": row.staff.employee_number or "",
                    "tsc_number": row.staff.tsc_number or "",
                    "national_id": row.staff.national_id or "",
                    "bank_name": row.staff.bank_name or "",
                    "bank_account": row.staff.bank_account or "",
                },
                "pay": {
                    "id": str(row.id),
                    "month": row.month.isoformat() if row.month else None,
                    "month_label": row.month.strftime("%B %Y") if row.month else "",
                    "basic_salary": str(row.basic_salary),
                    "allowances": str(row.allowances),
                    "deductions": str(row.deductions),
                    "net_salary": str(row.net_salary),
                    "status": row.status,
                    "status_display": row.get_status_display(),
                    "paid_at": row.paid_at.isoformat() if row.paid_at else None,
                    "payment_method": row.payment_method,
                    "notes": row.notes or "",
                    "reference": f"PAY-{str(row.id)[:8].upper()}",
                },
                "certification": "This is a computer-generated payslip from the school ERP.",
            }
        )


class LeaveRequestViewSet(ModelViewSet):
    queryset = LeaveRequest.objects.select_related("staff__user", "reviewed_by").all()
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    pagination_class = None

    def get_queryset(self):
        qs = self.queryset.filter(school_id__in=accessible_school_ids(self.request))
        status = self.request.query_params.get("status")
        staff_id = self.request.query_params.get("staff")
        if status:
            qs = qs.filter(status=status.upper())
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        return qs

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if not school:
            raise ValidationError({"detail": "No school selected"})
        staff = serializer.validated_data["staff"]
        if staff.school_id != school.id:
            raise PermissionDenied("Staff must belong to the selected school")
        start = serializer.validated_data["start_date"]
        end = serializer.validated_data["end_date"]
        if end < start:
            raise ValidationError({"end_date": "End date must be on or after start date"})
        days = serializer.validated_data.get("days") or ((end - start).days + 1)
        serializer.save(school=school, days=days, status=LeaveRequest.Status.PENDING)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        leave = self.get_object()
        leave.status = LeaveRequest.Status.APPROVED
        leave.reviewed_by = request.user
        leave.reviewed_at = timezone.now()
        leave.review_notes = (request.data.get("review_notes") or "")[:255]
        leave.save()
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        leave = self.get_object()
        leave.status = LeaveRequest.Status.REJECTED
        leave.reviewed_by = request.user
        leave.reviewed_at = timezone.now()
        leave.review_notes = (request.data.get("review_notes") or "")[:255]
        leave.save()
        return Response(LeaveRequestSerializer(leave).data)
