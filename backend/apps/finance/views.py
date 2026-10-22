from django.db import transaction
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from .models import (
    FeeCategory, FeeItem, FeeStructure, StudentFeeAssignment, PaymentPlan,
    Invoice, InvoiceLine, Payment
)
from .serializers import (
    FeeCategorySerializer, FeeCategoryLiteSerializer, FeeCategoryCreateUpdateSerializer,
    FeeItemSerializer, FeeItemCreateUpdateSerializer,
    FeeStructureSerializer, FeeStructureListSerializer, FeeStructureCreateUpdateSerializer,
    StudentFeeAssignmentSerializer, StudentFeeAssignmentCreateUpdateSerializer,
    InvoiceSerializer, InvoiceCreateUpdateSerializer,
    PaymentSerializer, PaymentCreateUpdateSerializer, PaymentPlanSerializer
)
from apps.core.permissions import IsAssociatedWithSchool  # Assume you have this
from apps.admissions.models import AdmissionFeePayment
from django.utils import timezone
from apps.school.support import accessible_school_ids, selected_school


def _round_money(value: Decimal) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _resolve_school_ids(request):
    return list(accessible_school_ids(request))


def _get_assignment_period_meta(assignment: StudentFeeAssignment):
    structure = getattr(assignment, "fee_structure", None)
    return (
        getattr(structure, "academic_year", "") or "",
        getattr(structure, "period_name", "") or "",
    )


def _build_finance_dashboard_summary(request):
    school_ids = _resolve_school_ids(request)
    today = timezone.now().date()

    assignments = list(
        StudentFeeAssignment.objects.filter(student__school_id__in=school_ids)
        .select_related("student", "fee_structure")
        .prefetch_related("selected_optional_items", "fee_structure__structure_items__item__category")
    )

    invoices = list(
        Invoice.objects.filter(
            Q(school_id__in=school_ids) | Q(student__school_id__in=school_ids)
        )
        .select_related("student", "fee_assignment", "fee_assignment__fee_structure")
        .prefetch_related(
            Prefetch("lines", queryset=InvoiceLine.objects.select_related("item__category")),
            "payments",
        )
    )

    # AdmissionFeePayment historically also stored enrollment term-fee deposits.
    # Only count true admission/registration receipts here — not school-fee deposits.
    all_admission_fee_rows = list(
        AdmissionFeePayment.objects.filter(application__school_id__in=school_ids).select_related("application")
    )

    def _is_school_fee_deposit(p) -> bool:
        method = (getattr(p, "payment_method", None) or "").lower()
        return (
            "school fee" in method
            or "enrollment" in method
            or "deposit" in method and "admission" not in method
        )

    admission_payments = [p for p in all_admission_fee_rows if not _is_school_fee_deposit(p)]
    legacy_deposit_rows = [p for p in all_admission_fee_rows if _is_school_fee_deposit(p)]

    total_assigned = Decimal("0")
    total_outstanding = Decimal("0")
    total_revenue = Decimal("0")
    students_with_balance = set()
    current_year_candidates = set()
    term_weights = defaultdict(int)
    revenue_by_period = {
        "all": Decimal("0"),
        "year": Decimal("0"),
        "term": Decimal("0"),
        "session": Decimal("0"),
    }

    fee_group_breakdown = {}

    def ensure_group(name: str, is_tuition: bool):
        key = name.strip() or "Other fees"
        if key not in fee_group_breakdown:
            fee_group_breakdown[key] = {
                "groupKey": key,
                "description": key,
                "allocated": Decimal("0"),
                "pending": Decimal("0"),
                "total": Decimal("0"),
                "isTuition": is_tuition,
            }
        elif is_tuition:
            fee_group_breakdown[key]["isTuition"] = True
        return fee_group_breakdown[key]

    invoices_by_assignment_id = defaultdict(list)
    for invoice in invoices:
        if invoice.fee_assignment_id:
            invoices_by_assignment_id[invoice.fee_assignment_id].append(invoice)

    for assignment in assignments:
        year, term = _get_assignment_period_meta(assignment)
        if year:
            current_year_candidates.add(year)

        assignment_items = assignment.get_assignment_items()
        assigned = sum((Decimal(str(item["cost"])) for item in assignment_items), Decimal("0"))
        assignment_invoices = invoices_by_assignment_id.get(assignment.id, [])

        if assignment_invoices:
            invoiced_total_due = sum(
                (Decimal(str(invoice.current_total_due)) for invoice in assignment_invoices),
                Decimal("0"),
            )
            remaining = sum(
                (max(Decimal("0"), Decimal(str(invoice.balance))) for invoice in assignment_invoices),
                Decimal("0"),
            )
            recognized = max(Decimal("0"), invoiced_total_due - remaining)
        else:
            remaining = sum((Decimal(str(item["remaining_amount"])) for item in assignment_items), Decimal("0"))
            recognized = max(Decimal("0"), assigned - remaining)

        total_assigned += assigned
        total_outstanding += remaining
        revenue_by_period["all"] += recognized

        if remaining > 0:
            students_with_balance.add(str(assignment.student_id))

        if year:
            term_weights[(year, term or "Term 1")] += 2 if remaining > 0 else 1

        if assignment_invoices:
            for invoice in assignment_invoices:
                invoice_line_total = sum((Decimal(str(line.amount)) for line in invoice.lines.all()), Decimal("0"))
                if invoice_line_total <= 0:
                    continue

                # Spread collected/pending value across lines proportionally so fee groups
                # reflect live invoice payments instead of only initial deposit allocations.
                payment_ratio = min(Decimal("1"), Decimal(str(invoice.amount_paid)) / invoice_line_total)

                for line in invoice.lines.all():
                    category = (
                        getattr(getattr(line.item, "category", None), "name", None)
                        or "Other fees"
                    ).strip() or "Other fees"
                    description = line.description or getattr(line.item, "name", "") or category
                    is_tuition = "tuition" in category.lower() or "tuition" in description.lower()
                    cost = Decimal(str(line.amount))
                    allocated = (cost * payment_ratio).quantize(Decimal("0.01"))
                    pending = max(Decimal("0"), cost - allocated)
                    group = ensure_group(category, is_tuition)
                    group["allocated"] += allocated
                    group["pending"] += pending
                    group["total"] += cost
        else:
            for item in assignment_items:
                category = (item.get("category") or "Other fees").strip() or "Other fees"
                is_tuition = "tuition" in category.lower() or "tuition" in str(item.get("description", "")).lower()
                allocated = Decimal(str(item.get("deposit_allocated", 0)))
                pending = Decimal(str(item.get("remaining_amount", 0)))
                cost = Decimal(str(item.get("cost", 0)))
                group = ensure_group(category, is_tuition)
                group["allocated"] += allocated
                group["pending"] += pending
                group["total"] += cost

        if year:
            revenue_by_period["year"] += recognized

    if current_year_candidates:
        detected_year = sorted(current_year_candidates)[-1]
    else:
        detected_year = str(today.year)

    detected_term = "Term 1"
    max_weight = -1
    for (year, term), weight in term_weights.items():
        if year == detected_year and weight > max_weight:
            max_weight = weight
            detected_term = term or "Term 1"

    for assignment in assignments:
        year, term = _get_assignment_period_meta(assignment)
        if year == detected_year:
            assignment_items = assignment.get_assignment_items()
            assignment_invoices = invoices_by_assignment_id.get(assignment.id, [])
            if assignment_invoices:
                assigned = sum((Decimal(str(item["cost"])) for item in assignment_items), Decimal("0"))
                remaining = sum(
                    (max(Decimal("0"), Decimal(str(invoice.balance))) for invoice in assignment_invoices),
                    Decimal("0"),
                )
                recognized = max(Decimal("0"), assigned - remaining)
            else:
                assigned = sum((Decimal(str(item["cost"])) for item in assignment_items), Decimal("0"))
                remaining = sum((Decimal(str(item["remaining_amount"])) for item in assignment_items), Decimal("0"))
                recognized = max(Decimal("0"), assigned - remaining)
            if term == detected_term:
                revenue_by_period["term"] += recognized
                revenue_by_period["session"] += recognized

    overdue_balance = sum(
        (
            max(Decimal("0"), Decimal(str(invoice.balance)))
            for invoice in invoices
            if max(Decimal("0"), Decimal(str(invoice.balance))) > 0 and invoice.due_date < today
        ),
        Decimal("0"),
    )
    pending_invoices = sum(1 for invoice in invoices if max(Decimal("0"), Decimal(str(invoice.balance))) > 0)

    total_revenue = sum((Decimal(str(invoice.amount_paid)) for invoice in invoices), Decimal("0"))
    total_revenue += sum((Decimal(str(p.amount)) for p in admission_payments), Decimal("0"))

    fee_assignment_ids = {assignment.id for assignment in assignments}
    for invoice in invoices:
        if invoice.fee_assignment_id not in fee_assignment_ids:
            balance = max(Decimal("0"), Decimal(str(invoice.balance)))
            amount_due = Decimal(str(invoice.current_total_due))
            total_assigned += amount_due
            total_outstanding += balance
            if balance > 0:
                students_with_balance.add(str(invoice.student_id))

    fee_group_values = []
    for entry in fee_group_breakdown.values():
        fee_group_values.append({
            "groupKey": entry["groupKey"],
            "description": entry["description"],
            "allocated": float(_round_money(entry["allocated"])),
            "pending": float(_round_money(entry["pending"])),
            "total": float(_round_money(entry["total"])),
            "isTuition": entry["isTuition"],
        })

    fee_group_values.sort(key=lambda item: (not item["isTuition"], item["description"]))

    return {
        "stats": {
            "totalOutstanding": float(_round_money(total_outstanding)),
            "totalAssigned": float(_round_money(total_assigned)),
            "totalRevenue": float(_round_money(total_revenue)),
            "totalStudentsWithFees": len(assignments),
            "studentsWithBalance": len(students_with_balance),
            "overdueBalance": float(_round_money(overdue_balance)),
            "pendingInvoices": pending_invoices,
            "totalInvoiced": float(_round_money(total_assigned)),
            "totalAdmissionPayments": float(_round_money(sum((Decimal(str(p.amount)) for p in admission_payments), Decimal("0")))),
            "legacyEnrollmentDeposits": float(_round_money(sum((Decimal(str(p.amount)) for p in legacy_deposit_rows), Decimal("0")))),
        },
        "revenueByPeriod": {
            "all": float(_round_money(revenue_by_period["all"])),
            "year": float(_round_money(revenue_by_period["year"])),
            "term": float(_round_money(revenue_by_period["term"])),
            "session": float(_round_money(revenue_by_period["session"])),
        },
        "detectedTerm": detected_term,
        "detectedYear": detected_year,
        "feeGroupBreakdown": fee_group_values,
    }


class FinanceDashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get(self, request):
        return Response(_build_finance_dashboard_summary(request))


class FeeCategoryViewSet(viewsets.ModelViewSet):
    queryset = FeeCategory.objects.select_related('school').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'is_mandatory']
    pagination_class = None  # few rows; form needs full list fast

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeCategoryCreateUpdateSerializer
        if self.action == "list":
            return FeeCategoryLiteSerializer
        return FeeCategorySerializer

    def get_queryset(self):
        qs = self.queryset.filter(
            school_id__in=accessible_school_ids(self.request)
        )
        if self.action == "list":
            return qs.only("id", "name", "is_mandatory", "display_order", "school_id")
        return qs


class FeeItemViewSet(viewsets.ModelViewSet):
    queryset = FeeItem.objects.select_related('category').prefetch_related('grade_levels').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'is_active', 'is_statutory']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeItemCreateUpdateSerializer
        return FeeItemSerializer

    def get_queryset(self):
        return self.queryset.filter(
            category__school_id__in=accessible_school_ids(self.request)
        )

    @action(detail=False, methods=['get'], url_path='by-category/(?P<category_id>[^/.]+)')
    def by_category(self, request, category_id=None):
        items = self.get_queryset().filter(category_id=category_id)
        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)


def create_invoice_lines(invoice: Invoice, assignment: StudentFeeAssignment, proportion: Decimal = Decimal('1')):
    """Create invoice line items for a generated invoice."""
    assignment_items = assignment.get_assignment_items()
    if not assignment_items:
        return

    line_amounts = []
    for entry in assignment_items:
        amount = (entry.get('remaining_amount', entry.get('cost', Decimal('0'))) * proportion).quantize(Decimal('0.01'))
        if amount <= Decimal('0.00'):
            continue
        line_amounts.append({
            'item': entry['item'],
            'description': entry['description'],
            'amount': amount,
        })

    total_line_amount = sum(line['amount'] for line in line_amounts)
    diff = invoice.amount_due - total_line_amount
    if line_amounts and diff != Decimal('0.00'):
        line_amounts[-1]['amount'] += diff

    for line in line_amounts:
        InvoiceLine.objects.create(
            invoice=invoice,
            item=line['item'],
            description=line['description'],
            amount=line['amount']
        )

class FeeStructureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'grade_level', 'is_active']
    # List pages need full set quickly
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeStructureCreateUpdateSerializer
        # Offer letter / forms need line items on list: ?include_items=1
        if self.action == "list" and self.request.query_params.get("include_items") != "1":
            return FeeStructureListSerializer
        return FeeStructureSerializer


    def perform_create(self, serializer):
        school = selected_school(self.request)
        serializer.save(school=school)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Fast response body (avoid re-serializing heavy nested trees)
        out = FeeStructureSerializer(serializer.instance, context={"request": request})
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    def get_queryset(self):
        from django.db.models import Sum, Prefetch
        from .models import FeeStructureItem

        qs = FeeStructure.objects.filter(
            school_id__in=accessible_school_ids(self.request)
        ).select_related("grade_level")

        grade_level = self.request.query_params.get("grade_level")
        if grade_level:
            qs = qs.filter(grade_level_id=grade_level)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=(str(is_active).lower() == "true"))

        qs = qs.annotate(items_total=Sum("structure_items__amount"))

        need_items = (
            self.action != "list"
            or self.request.query_params.get("include_items") == "1"
        )
        if need_items:
            qs = qs.prefetch_related(
                Prefetch(
                    "structure_items",
                    queryset=FeeStructureItem.objects.select_related("item", "item__category"),
                ),
                "available_optional_items",
            )
        return qs.order_by("-academic_year", "period_name", "name")


    @action(detail=True, methods=['get'], url_path='preview')
    def preview(self, request, pk=None):
        structure = self.get_object()
        return Response({
            'total_amount': structure.total_amount,
            'items_by_category': structure.get_items_by_category()
        })

    @action(detail=True, methods=['post'], url_path='clone')
    @transaction.atomic
    def clone(self, request, pk=None):
        """
        Clone a fee structure (items included) to another period/grade/year.
        Body (all optional): period_name, academic_year, name, grade_level, is_active
        """
        from apps.finance.models import FeeStructure, FeeStructureItem
        from apps.academics.models import GradeLevel

        source = self.get_object()
        school = source.school

        period_name = (request.data.get("period_name") or source.period_name or "Term 1").strip()
        academic_year = (request.data.get("academic_year") or source.academic_year or "").strip()
        name = (request.data.get("name") or "").strip()
        if not name:
            name = f"{source.grade_level.name} – {period_name} – {academic_year}"

        grade_level = source.grade_level
        grade_level_id = request.data.get("grade_level")
        if grade_level_id:
            try:
                grade_level = GradeLevel.objects.get(pk=grade_level_id, school=school)
            except GradeLevel.DoesNotExist:
                return Response(
                    {"detail": "Grade level not found for this school."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        is_active = request.data.get("is_active")
        if is_active is None:
            is_active = True
        elif isinstance(is_active, str):
            is_active = is_active.lower() in ("1", "true", "yes")

        # Unique constraint: school + grade + period type + period name + year
        exists = FeeStructure.objects.filter(
            school=school,
            grade_level=grade_level,
            billing_period_type=source.billing_period_type,
            period_name=period_name,
            academic_year=academic_year,
        ).exists()
        if exists:
            return Response(
                {
                    "detail": (
                        f"A structure already exists for {grade_level.name} / "
                        f"{period_name} / {academic_year}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        clone = FeeStructure.objects.create(
            school=school,
            name=name,
            description=source.description,
            grade_level=grade_level,
            academic_year=academic_year,
            billing_period_type=source.billing_period_type,
            period_name=period_name,
            is_active=bool(is_active),
        )
        for si in source.structure_items.select_related("item").all():
            FeeStructureItem.objects.create(
                structure=clone,
                item=si.item,
                amount=si.amount,
            )
        # Optional items M2M
        clone.available_optional_items.set(source.available_optional_items.all())

        serializer = FeeStructureSerializer(clone, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class StudentFeeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = StudentFeeAssignment.objects.select_related('student', 'fee_structure').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'fee_structure', 'is_waived']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentFeeAssignmentCreateUpdateSerializer
        return StudentFeeAssignmentSerializer

    def get_queryset(self):
        return self.queryset.filter(
            student__school_id__in=accessible_school_ids(self.request)
        )

    @action(detail=True, methods=['post'], url_path='generate-invoice')
    def generate_invoice(self, request, pk=None):
        assignment = self.get_object()
        plan = assignment.payment_plan
        
        # Determine the start date for payment schedules
        start_date = timezone.now().date()
        academic_year = request.data.get('academic_year', assignment.fee_structure.academic_year)
        term = request.data.get('term', assignment.fee_structure.period_name)

        # 1. Logic for Single/Full Payment (No Plan)
        if not plan or plan.number_of_installments <= 1:
            due_date = start_date + timedelta(days=14)
            if plan and plan.days_interval:
                due_date = start_date + timedelta(days=plan.days_interval)

            invoice = Invoice.objects.create(
                student=assignment.student,
                fee_assignment=assignment,
                school=assignment.student.school,
                term=term,
                academic_year=academic_year,
                amount_due=assignment.remaining_total,
                due_date=due_date,
                generated_by=request.user
            )
            create_invoice_lines(invoice, assignment, Decimal('1'))
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

        # 2. Logic for Flexible Installments (Weekly, Monthly, etc.)
        total_amount = assignment.remaining_total
        num_installments = plan.number_of_installments
        amount_per_installment = total_amount / num_installments
        
        # Determine interval based on plan_type (from your model choices)
        interval_map = {
            'weekly': 7,
            'monthly': 30,
            'quarterly': 90,
            'semester': 120,
            'termly': 120, # Adjust based on your school calendar
        }
        days_step = plan.days_interval or interval_map.get(plan.plan_type.lower(), 30)

        created_invoices = []
        for i in range(num_installments):
            due_date = start_date + timedelta(days=((i + 1) * days_step))
            
            invoice = Invoice.objects.create(
                student=assignment.student,
                fee_assignment=assignment,
                school=assignment.student.school,
                payment_plan=plan,
                installment_number=i + 1,
                term=term,
                academic_year=academic_year,
                amount_due=amount_per_installment,
                due_date=due_date,
                generated_by=request.user
            )
            proportion = (invoice.amount_due / total_amount) if total_amount else Decimal('0')
            create_invoice_lines(invoice, assignment, proportion)
            created_invoices.append(invoice)

        return Response(
            InvoiceSerializer(created_invoices, many=True).data, 
            status=status.HTTP_201_CREATED
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('student', 'fee_assignment__fee_structure').prefetch_related('payments').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'term', 'academic_year', 'is_paid']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InvoiceCreateUpdateSerializer
        return InvoiceSerializer

  
    def get_queryset(self):
        school_ids = accessible_school_ids(self.request)
        return self.queryset.filter(
            Q(school_id__in=school_ids) | Q(student__school_id__in=school_ids)
        ).distinct()

    @action(detail=False, methods=['get'], url_path='overdue')
    def overdue_invoices(self, request):
        overdue = self.get_queryset().filter(due_date__lt=timezone.now().date(), is_paid=False)
        serializer = self.get_serializer(overdue, many=True)
        return Response(serializer.data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('invoice__student', 'paid_by').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['invoice', 'invoice__student', 'payment_method', 'paid_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentCreateUpdateSerializer
        return PaymentSerializer


    def get_queryset(self):
        return self.queryset.filter(
            school_id__in=accessible_school_ids(self.request)
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        payment.invoice.refresh_from_db()  # Re-calculate balance
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        payment = self.get_object()
        invoice = payment.invoice
        lines = []
        for line in invoice.lines.select_related('item__category').all():
            lines.append({
                'description': line.description,
                'category': line.item.category.name if line.item and line.item.category else 'Unknown',
                'amount': float(line.amount),
            })

        return Response({
            'payment_id': str(payment.id),
            'invoice_number': invoice.invoice_number,
            'student_name': invoice.student.full_name,
            'payment_method': payment.payment_method,
            'reference_number': payment.reference_number,
            'amount': float(payment.amount),
            'paid_at': payment.paid_at,
            'invoice_amount_due': float(invoice.amount_due),
            'invoice_amount_paid': float(invoice.amount_paid),
            'invoice_balance': float(invoice.balance),
            'invoice_term': invoice.term,
            'invoice_year': invoice.academic_year,
            'line_items': lines,
        })
    
class PaymentPlanViewSet(viewsets.ModelViewSet):
    queryset = PaymentPlan.objects.prefetch_related('installments').all()
    serializer_class = PaymentPlanSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return self.queryset.filter(
            school_id__in=accessible_school_ids(self.request)
        )

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

    def list(self, request, *args, **kwargs):
        """Auto-seed sensible defaults when school has no plans yet."""
        try:
            school = selected_school(request)
        except Exception:
            school = None
            ids = list(accessible_school_ids(request) or [])
            if ids:
                from apps.school.models import School
                school = School.objects.filter(pk=ids[0]).first()
        qs = self.filter_queryset(self.get_queryset())
        if school:
            qs = qs.filter(school=school)
        if school and not qs.exists():
            PaymentPlan.objects.get_or_create(
                school=school,
                name="Full payment",
                defaults={
                    "plan_type": "full",
                    "number_of_installments": 1,
                    "days_interval": 0,
                    "is_active": True,
                    "is_recommended": True,
                    "description": "Pay the full term amount",
                    "first_installment_percentage": 100,
                },
            )
            PaymentPlan.objects.get_or_create(
                school=school,
                name="Two installments",
                defaults={
                    "plan_type": "custom",
                    "number_of_installments": 2,
                    "days_interval": 30,
                    "is_active": True,
                    "is_recommended": False,
                    "description": "Split the term balance into two payments",
                    "first_installment_percentage": 50,
                },
            )
            qs = self.filter_queryset(self.get_queryset()).filter(school=school)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated


class IncomeReceiptListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import IncomeReceipt
        from apps.school.support import selected_school
        school = selected_school(request)
        qs = IncomeReceipt.objects.all()
        if school:
            qs = qs.filter(school=school)
        source = request.query_params.get("source")
        if source:
            qs = qs.filter(source=source.upper())
        data = [
            {
                "id": str(r.id),
                "source": r.source,
                "amount": str(r.amount),
                "payment_method": r.payment_method,
                "reference_number": r.reference_number,
                "notes": r.notes,
                "paid_at": r.paid_at,
                "application_id": str(r.application_id) if r.application_id else None,
                "student_id": str(r.student_id) if r.student_id else None,
                "account": str(r.account_id) if r.account_id else None,
            }
            for r in qs.order_by("-paid_at")[:200]
        ]
        return Response(data)
