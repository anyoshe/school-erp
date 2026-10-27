import re
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


def _empty_fee_groups():
    """Minimal fallback if aggregation fails."""
    return [
        {
            "groupKey": "interview",
            "description": "Interview fee",
            "allocated": 0.0,
            "pending": 0.0,
            "total": 0.0,
            "isTuition": False,
        },
        {
            "groupKey": "admission_registration",
            "description": "Admission / registration fee",
            "allocated": 0.0,
            "pending": 0.0,
            "total": 0.0,
            "isTuition": False,
        },
    ]


def _safe_fee_group_breakdown(**kwargs):
    try:
        return _fee_group_breakdown(**kwargs)
    except Exception as exc:
        print(f"[finance dashboard] fee group breakdown failed: {exc}")
        return _empty_fee_groups()



def _fee_group_breakdown(school_ids, inv_term, pay_term, interview_income, admission_income):
    """
    Dynamic fee groups from fee items / invoice lines + interview/admission.
    Near-duplicates like "Exams" and "Exams fee" are merged; prefer the label
    that has money, otherwise the shorter name without a redundant "fee" suffix.
    """
    from collections import defaultdict
    from django.db.models import Prefetch

    # norm_key -> totals + preferred display label
    groups = defaultdict(
        lambda: {
            "collected": Decimal("0"),
            "billed": Decimal("0"),
            "pending": Decimal("0"),
            "label": "",
            "label_score": -1,
        }
    )
    order = []  # first-seen norm keys

    def norm_key(label: str) -> str:
        s = re.sub(r"\s+", " ", (label or "").strip())
        s = re.sub(r"[\s\-_]*fees?$", "", s, flags=re.IGNORECASE).strip()
        s = re.sub(r"[\s\-_]+", " ", s).strip().lower()
        return s or "unnamed fee"

    def label_score(label: str, has_money: bool) -> int:
        """Higher = preferred display name."""
        score = 0
        if has_money:
            score += 100
        # Prefer names that already look like parent items (no trailing "fee")
        if not re.search(r"\bfees?$", label.strip(), flags=re.I):
            score += 10
        # Prefer shorter labels slightly
        score -= min(len(label), 40) // 10
        return score

    def ensure(label: str, *, has_money: bool = False) -> str:
        label = re.sub(r"\s+", " ", (label or "").strip())[:80] or "Unnamed fee"
        key = norm_key(label)
        if key not in groups:
            order.append(key)
        g = groups[key]
        sc = label_score(label, has_money)
        if not g["label"] or sc > g["label_score"]:
            g["label"] = label
            g["label_score"] = sc
        elif has_money and sc >= g["label_score"]:
            g["label"] = label
            g["label_score"] = sc
        return key

    # Seed structure items (may be zero — will be dropped later if still zero
    # and not interview/admission, unless we keep structure seeds with activity only)
    try:
        for struct in FeeStructure.objects.filter(
            school_id__in=list(school_ids)
        ).prefetch_related("structure_items__item"):
            for si in struct.structure_items.all():
                name = ""
                if si.item_id and getattr(si.item, "name", None):
                    name = si.item.name
                elif getattr(si, "description", None):
                    name = si.description
                if name:
                    ensure(name, has_money=False)
        for fi in FeeItem.objects.filter(
            category__school_id__in=list(school_ids)
        ).only("name"):
            if fi.name:
                ensure(fi.name, has_money=False)
    except Exception as exc:
        print(f"[finance dashboard] seed fee items failed: {exc}")

    ensure("Interview fee", has_money=False)
    ensure("Admission / registration fee", has_money=False)

    def line_label(line) -> str:
        if line.item_id and getattr(line.item, "name", None):
            return line.item.name.strip()[:80]
        if (line.description or "").strip():
            return line.description.strip()[:80]
        return "Unnamed fee"

    inv_ids = list(inv_term.values_list("id", flat=True)[:5000])
    line_qs = InvoiceLine.objects.filter(invoice_id__in=inv_ids).select_related(
        "item", "invoice"
    )
    for line in line_qs:
        key = ensure(line_label(line), has_money=True)
        amt = Decimal(str(line.amount or 0))
        groups[key]["billed"] += amt
        inv = line.invoice
        due = Decimal(str(inv.amount_due or 0)) + Decimal(
            str(getattr(inv, "late_fee_applied", 0) or 0)
        )
        paid = Decimal(str(inv.amount_paid or 0))
        if due > 0:
            ratio = max(Decimal("0"), (due - paid) / due)
            groups[key]["pending"] += (amt * ratio).quantize(Decimal("0.01"))

    try:
        pays = list(
            pay_term.select_related("invoice")
            .prefetch_related(
                Prefetch(
                    "invoice__lines",
                    queryset=InvoiceLine.objects.select_related("item"),
                )
            )[:2000]
        )
    except Exception as exc:
        print(f"[finance dashboard] pay_term load failed: {exc}")
        pays = []

    for pay in pays:
        amt = Decimal(str(pay.amount or 0))
        if amt <= 0:
            continue
        try:
            allocs = list(getattr(pay, "line_allocations", None) or [])
        except Exception:
            allocs = []
        if allocs:
            for a in allocs:
                if not isinstance(a, dict):
                    continue
                a_amt = Decimal(str(a.get("amount") or 0))
                if a_amt <= 0:
                    continue
                key = ensure(
                    str(a.get("description") or a.get("category") or "Fee item"),
                    has_money=True,
                )
                groups[key]["collected"] += a_amt
            continue
        lines = list(pay.invoice.lines.all()) if pay.invoice_id else []
        if lines:
            total = sum(
                (Decimal(str(ln.amount or 0)) for ln in lines), Decimal("0")
            ) or Decimal("1")
            for ln in lines:
                key = ensure(line_label(ln), has_money=True)
                share = (Decimal(str(ln.amount or 0)) / total) * amt
                groups[key]["collected"] += share
        else:
            key = ensure("School fees", has_money=True)
            groups[key]["collected"] += amt

    groups[ensure("Interview fee", has_money=bool(interview_income))][
        "collected"
    ] += Decimal(str(interview_income or 0))
    groups[ensure("Admission / registration fee", has_money=bool(admission_income))][
        "collected"
    ] += Decimal(str(admission_income or 0))

    preferred_norms = {
        norm_key("Interview fee"),
        norm_key("Admission / registration fee"),
    }
    seen = set()
    out = []

    def push(key: str):
        if key in seen:
            return
        seen.add(key)
        g = groups[key]
        label = g["label"] or key
        out.append(
            {
                "groupKey": re.sub(r"[^a-z0-9]+", "_", key)[:48],
                "description": label,
                "allocated": float(_round_money(g["collected"])),
                "pending": float(_round_money(g["pending"])),
                "total": float(_round_money(g["billed"])),
                "isTuition": "tuition" in label.lower(),
            }
        )

    # Interview & admission first (always shown)
    for key in list(preferred_norms):
        if key in groups:
            push(key)

    rest = [k for k in order if k not in preferred_norms]
    rest.sort(
        key=lambda k: (
            0
            if (
                groups[k]["collected"]
                or groups[k]["pending"]
                or groups[k]["billed"]
            )
            else 1,
            (groups[k]["label"] or k).lower(),
        )
    )
    for key in rest:
        g = groups[key]
        has_fig = bool(g["collected"] or g["pending"] or g["billed"])
        # Drop zero-only seeds that never received activity
        if not has_fig:
            continue
        push(key)

    return out


def _build_finance_dashboard_summary(request):
    school_ids = _resolve_school_ids(request)
    today = timezone.now().date()
    from django.db.models import Sum as DjSum, Count, Q as DjQ

    # ── Fast aggregates (avoid loading every assignment/invoice into memory) ──
    inv_base = Invoice.objects.filter(
        Q(school_id__in=school_ids) | Q(student__school_id__in=school_ids)
    )
    pay_base = Payment.objects.filter(
        Q(school_id__in=school_ids) | Q(invoice__student__school_id__in=school_ids)
    ).exclude(payment_method="TRANSFER")

    school_fee_collected_fast = pay_base.aggregate(t=DjSum("amount"))["t"] or Decimal("0")
    total_invoiced_fast = inv_base.aggregate(t=DjSum("amount_due"))["t"] or Decimal("0")
    # Outstanding = sum of (amount_due + late - amount_paid) for unpaid
    outstanding_fast = Decimal("0")
    overdue_fast = Decimal("0")
    pending_count = 0
    students_bal = set()
    for row in inv_base.values("id", "student_id", "amount_due", "late_fee_applied", "amount_paid", "due_date"):
        due = Decimal(str(row["amount_due"] or 0)) + Decimal(str(row["late_fee_applied"] or 0))
        paid = Decimal(str(row["amount_paid"] or 0))
        bal = max(Decimal("0"), due - paid)
        if bal > 0:
            pending_count += 1
            outstanding_fast += bal
            students_bal.add(str(row["student_id"]))
            if row["due_date"] and row["due_date"] < today:
                overdue_fast += bal

    try:
        from .models import IncomeReceipt
        pre_enroll_income = (
            IncomeReceipt.objects.filter(school_id__in=list(school_ids)).aggregate(t=DjSum("amount"))["t"]
            or Decimal("0")
        )
        interview_income_amt = (
            IncomeReceipt.objects.filter(school_id__in=list(school_ids), source="INTERVIEW").aggregate(t=DjSum("amount"))["t"]
            or Decimal("0")
        )
        admission_income_amt = (
            IncomeReceipt.objects.filter(school_id__in=list(school_ids), source="ADMISSION").aggregate(t=DjSum("amount"))["t"]
            or Decimal("0")
        )
    except Exception:
        pre_enroll_income = Decimal("0")
        interview_income_amt = Decimal("0")
        admission_income_amt = Decimal("0")

    # ── Detect current academic year / term (or use query filters) ──
    try:
        from apps.finance.clearance import _detect_year_term
    except Exception:
        def _detect_year_term(_school):
            return (str(today.year), "Term 1")
    school_obj = None
    try:
        from apps.school.models import School
        if school_ids:
            school_obj = School.objects.filter(pk=list(school_ids)[0]).first()
    except Exception:
        school_obj = None
    try:
        auto_year, auto_term = _detect_year_term(school_obj) if school_obj else (str(today.year), "Term 1")
    except Exception:
        auto_year, auto_term = str(today.year), "Term 1"

    q_year = (request.GET.get("academic_year") or request.GET.get("year") or "").strip()
    q_term = (request.GET.get("term") or "").strip()
    selected_year = q_year or auto_year
    selected_term = q_term or auto_term

    # Available terms/years from invoices + payments for the switcher
    term_labels = list(
        inv_base.exclude(term="").exclude(term__isnull=True)
        .values_list("term", flat=True).distinct()
    )
    year_labels = list(
        inv_base.exclude(academic_year="").exclude(academic_year__isnull=True)
        .values_list("academic_year", flat=True).distinct()
    )
    for t in pay_base.exclude(term="").values_list("term", flat=True).distinct():
        if t and t not in term_labels:
            term_labels.append(t)
    for y in pay_base.exclude(academic_year="").values_list("academic_year", flat=True).distinct():
        if y and y not in year_labels:
            year_labels.append(y)
    for label in ("Term 1", "Term 2", "Term 3"):
        if label not in term_labels:
            term_labels.append(label)
    if selected_year and selected_year not in year_labels:
        year_labels.insert(0, selected_year)

    # Filter invoice/payment sets for selected term + year
    inv_term = inv_base.filter(academic_year=selected_year).filter(
        Q(term__iexact=selected_term) | Q(term__icontains=selected_term.split()[-1] if selected_term else "")
    )
    # Fallback if no exact match: by year only then all
    if not inv_term.exists():
        inv_term = inv_base.filter(academic_year=selected_year)
    if not inv_term.exists():
        inv_term = inv_base

    pay_term = pay_base.filter(
        Q(academic_year=selected_year) | Q(invoice__academic_year=selected_year)
    ).filter(
        Q(term__iexact=selected_term)
        | Q(term__icontains=selected_term.split()[-1] if selected_term else "")
        | Q(invoice__term__iexact=selected_term)
        | Q(invoice__term__icontains=selected_term.split()[-1] if selected_term else "")
    )
    if not pay_term.exists():
        pay_term = pay_base.filter(
            Q(academic_year=selected_year) | Q(invoice__academic_year=selected_year)
        )

    pay_year = pay_base.filter(
        Q(academic_year=selected_year) | Q(invoice__academic_year=selected_year)
    )
    inv_year = inv_base.filter(academic_year=selected_year)

    collected_term = pay_term.aggregate(t=DjSum("amount"))["t"] or Decimal("0")
    collected_year = pay_year.aggregate(t=DjSum("amount"))["t"] or Decimal("0")
    collected_all = school_fee_collected_fast

    invoiced_term = inv_term.aggregate(t=DjSum("amount_due"))["t"] or Decimal("0")
    invoiced_year = inv_year.aggregate(t=DjSum("amount_due"))["t"] or Decimal("0")

    outstanding_term = Decimal("0")
    overdue_term = Decimal("0")
    pending_term = 0
    students_bal_term = set()
    for row in inv_term.values("student_id", "amount_due", "late_fee_applied", "amount_paid", "due_date"):
        due = Decimal(str(row["amount_due"] or 0)) + Decimal(str(row["late_fee_applied"] or 0))
        paid = Decimal(str(row["amount_paid"] or 0))
        bal = max(Decimal("0"), due - paid)
        if bal > 0:
            pending_term += 1
            outstanding_term += bal
            students_bal_term.add(str(row["student_id"]))
            if row["due_date"] and row["due_date"] < today:
                overdue_term += bal

    # Prefer fast path for headline stats (term-scoped by default)
    use_lite = True

    if use_lite:
        return {
            "stats": {
                "totalOutstanding": float(_round_money(outstanding_term)),
                "totalAssigned": float(_round_money(invoiced_term)),
                "totalRevenue": float(_round_money(collected_term)),
                "totalStudentsWithFees": StudentFeeAssignment.objects.filter(
                    student__school_id__in=school_ids
                ).count(),
                "studentsWithBalance": len(students_bal_term),
                "overdueBalance": float(_round_money(overdue_term)),
                "pendingInvoices": pending_term,
                "totalInvoiced": float(_round_money(invoiced_term)),
                "totalAdmissionPayments": float(_round_money(admission_income_amt)),
                "totalInterviewPayments": float(_round_money(interview_income_amt)),
                "preEnrollmentIncome": float(_round_money(pre_enroll_income)),
                "schoolFeeCollected": float(_round_money(collected_term)),
                "legacyEnrollmentDeposits": 0.0,
                "yearCollected": float(_round_money(collected_year)),
                "yearInvoiced": float(_round_money(invoiced_year)),
                "allTimeCollected": float(_round_money(collected_all)),
            },
            "revenueByPeriod": {
                "all": float(_round_money(collected_all)),
                "year": float(_round_money(collected_year)),
                "term": float(_round_money(collected_term)),
                "session": float(_round_money(collected_term)),
            },
            "detectedTerm": selected_term,
            "detectedYear": selected_year,
            "availableTerms": sorted(set(str(x) for x in term_labels if x)),
            "availableYears": sorted(set(str(x) for x in year_labels if x), reverse=True),
            "isCurrentTerm": (selected_term == auto_term and selected_year == auto_year),
            "feeGroupBreakdown": _safe_fee_group_breakdown(
                school_ids=list(school_ids),
                inv_term=inv_term,
                pay_term=pay_term,
                interview_income=interview_income_amt,
                admission_income=admission_income_amt,
            ),
        }


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

    # SOURCE OF TRUTH for "Collected" = real Payment rows (not drifted invoice.amount_paid)
    from django.db.models import Sum as DjSum
    school_fee_collected = (
        Payment.objects.filter(
            Q(school_id__in=list(school_ids)) | Q(invoice__student__school_id__in=list(school_ids))
        )
        .exclude(payment_method="TRANSFER")
        .aggregate(t=DjSum("amount"))["t"]
        or Decimal("0")
    )
    # Keep invoice.amount_paid in sync when reporting outstanding
    total_revenue = school_fee_collected

    try:
        from .models import IncomeReceipt
        pre_enroll_income = (
            IncomeReceipt.objects.filter(school_id__in=list(school_ids)).aggregate(t=DjSum("amount"))["t"]
            or Decimal("0")
        )
        interview_income_amt = (
            IncomeReceipt.objects.filter(school_id__in=list(school_ids), source="INTERVIEW").aggregate(t=DjSum("amount"))["t"]
            or Decimal("0")
        )
        admission_income_amt = (
            IncomeReceipt.objects.filter(school_id__in=list(school_ids), source="ADMISSION").aggregate(t=DjSum("amount"))["t"]
            or Decimal("0")
        )
    except Exception:
        pre_enroll_income = Decimal("0")
        interview_income_amt = Decimal("0")
        admission_income_amt = Decimal("0")

    total_revenue_with_pre = school_fee_collected + pre_enroll_income

    # Force period buckets = actual payments only (no structure "recognition" as cash)
    revenue_by_period["all"] = school_fee_collected
    revenue_by_period["year"] = school_fee_collected
    revenue_by_period["term"] = school_fee_collected
    revenue_by_period["session"] = school_fee_collected


    # Align period buckets so they cannot exceed real Payment totals (stops 16.4k term vs 1.8k collected)
    try:
        if school_fee_collected > 0:
            # Prefer payment truth for "all" / headline year when recognition drifted
            revenue_by_period["all"] = school_fee_collected
            # Cap year/term/session at actual collections
            for k in ("year", "term", "session"):
                if revenue_by_period.get(k, Decimal("0")) > school_fee_collected:
                    revenue_by_period[k] = school_fee_collected
                # If recognition under-counted vs payments, lift "all" already set
        else:
            revenue_by_period["all"] = school_fee_collected
    except Exception:
        pass


    # Outstanding from invoices using payment-based paid amounts
    total_outstanding = Decimal("0")
    students_with_balance = set()
    pending_invoices = 0
    overdue_balance = Decimal("0")
    for invoice in invoices:
        paid = sum(
            (Decimal(str(p.amount)) for p in invoice.payments.all() if getattr(p, "payment_method", None) != "TRANSFER"),
            Decimal("0"),
        )
        due = Decimal(str(invoice.amount_due or 0)) + Decimal(str(invoice.late_fee_applied or 0))
        bal = max(Decimal("0"), due - paid)
        total_outstanding += bal
        if bal > 0:
            pending_invoices += 1
            students_with_balance.add(str(invoice.student_id))
            if invoice.due_date and invoice.due_date < today:
                overdue_balance += bal

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

    # Rescale fee groups to Payment totals so UI cannot show 14.6k "collected" while Payments are 1.8k
    try:
        group_sum = sum((Decimal(str(g["allocated"])) for g in fee_group_values), Decimal("0"))
        if group_sum > 0 and school_fee_collected >= 0:
            scale = Decimal(str(school_fee_collected)) / group_sum
            for g in fee_group_values:
                g["allocated"] = float(_round_money(Decimal(str(g["allocated"])) * scale))
                g["pending"] = float(_round_money(Decimal(str(g.get("pending", 0))) * scale)) if scale <= 1 else 0.0
                g["total"] = float(_round_money(Decimal(str(g["allocated"])) + Decimal(str(g.get("pending", 0)))))
    except Exception:
        pass


    return {
        "stats": {
            "totalOutstanding": float(_round_money(total_outstanding)),
            "totalAssigned": float(_round_money(total_assigned)),
            "totalRevenue": float(_round_money(school_fee_collected)),
            "totalStudentsWithFees": len(assignments),
            "studentsWithBalance": len(students_with_balance),
            "overdueBalance": float(_round_money(overdue_balance)),
            "pendingInvoices": pending_invoices,
            "totalInvoiced": float(_round_money(total_assigned)),
            "totalAdmissionPayments": float(_round_money(admission_income_amt)),
            "totalInterviewPayments": float(_round_money(interview_income_amt)),
            "preEnrollmentIncome": float(_round_money(pre_enroll_income)),
            "schoolFeeCollected": float(_round_money(school_fee_collected)),
            "legacyEnrollmentDeposits": 0.0,
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

        period_name = (request.data.get("period_name") or source.period_name or "").strip()
        academic_year = (request.data.get("academic_year") or source.academic_year or "").strip()
        if not period_name or not academic_year:
            return Response(
                {"detail": "A billing period and academic year are required to clone a fee structure."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
        structure = assignment.fee_structure
        if structure is None:
            return Response(
                {"detail": "Assign a fee structure before generating invoices."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        academic_year = structure.academic_year
        term = structure.period_name
        if not academic_year or not term:
            return Response(
                {"detail": "The fee structure must specify an academic year and period."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = assignment.payment_plan
        
        # Determine the start date for payment schedules
        start_date = timezone.now().date()

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
        if self.action == "list":
            from .serializers import InvoiceLiteSerializer
            return InvoiceLiteSerializer
        return InvoiceSerializer

    def get_queryset(self):
        school_ids = accessible_school_ids(self.request)
        qs = Invoice.objects.select_related("student").filter(
            Q(school_id__in=school_ids) | Q(student__school_id__in=school_ids)
        ).distinct()
        unpaid = self.request.query_params.get("unpaid")
        if unpaid in ("1", "true", "True"):
            # balance > 0 approximately
            from django.db.models import F
            qs = qs.filter(is_paid=False)
        # list does not need payments/lines
        return qs.only(
            "id", "invoice_number", "student_id", "amount_due", "amount_paid",
            "late_fee_applied", "balance", "is_paid", "due_date", "term",
            "academic_year", "school_id",
        )

    @action(detail=False, methods=['get'], url_path='overdue')
    def overdue_invoices(self, request):
        overdue = self.get_queryset().filter(due_date__lt=timezone.now().date(), is_paid=False)
        serializer = self.get_serializer(overdue, many=True)
        return Response(serializer.data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('invoice__student', 'paid_by').all()
    pagination_class = None
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['invoice', 'invoice__student', 'payment_method', 'paid_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentCreateUpdateSerializer
        if self.action == "list":
            from .serializers import PaymentListSerializer
            return PaymentListSerializer
        return PaymentSerializer


    def get_queryset(self):
        school_ids = accessible_school_ids(self.request)
        qs = self.queryset.filter(
            Q(school_id__in=school_ids) | Q(invoice__student__school_id__in=school_ids)
        ).order_by("-payment_date", "-paid_at")
        limit = self.request.query_params.get("limit")
        if limit:
            try:
                return qs[: int(limit)]
            except Exception:
                return qs[:40]
        if self.action == "list":
            return qs[:40]
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        payment.invoice.refresh_from_db()  # Re-calculate balance
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        from decimal import Decimal
        payment = self.get_object()
        invoice = payment.invoice
        student = invoice.student
        school = invoice.school or getattr(student, "school", None)

        inv_due = Decimal(str(invoice.amount_due or 0)) + Decimal(str(invoice.late_fee_applied or 0))
        pay_amt = Decimal(str(payment.amount or 0))
        # Prefer cashier allocations on this payment; else show billed invoice lines
        allocs = getattr(payment, "line_allocations", None) or []
        raw_lines = list(invoice.lines.select_related("item__category").all())
        lines = []
        if allocs and isinstance(allocs, list) and any(float(a.get("amount") or 0) > 0 for a in allocs if isinstance(a, dict)):
            for a in allocs:
                if not isinstance(a, dict):
                    continue
                amt = float(a.get("amount") or 0)
                if amt <= 0:
                    continue
                lines.append({
                    "description": a.get("description") or "Fee item",
                    "category": a.get("category") or "Fees",
                    "line_amount": amt,
                    "amount": amt,
                    "allocated": True,
                })
        else:
            for line in raw_lines:
                lines.append({
                    "description": line.description or (
                        line.item.name if line.item_id else "Fee item"
                    ),
                    "category": (
                        line.item.category.name
                        if line.item_id and line.item and line.item.category_id
                        else "Fees"
                    ),
                    "line_amount": float(line.amount or 0),
                    "amount": float(line.amount or 0),
                    "allocated": False,
                })
            if not lines:
                lines.append({
                    "description": f"School fees — {invoice.invoice_number}",
                    "category": "Fees",
                    "line_amount": float(inv_due),
                    "amount": float(inv_due),
                    "allocated": False,
                })

        logo_url = None
        if school and getattr(school, "logo", None):
            try:
                logo_url = request.build_absolute_uri(school.logo.url)
            except Exception:
                logo_url = None

        paid_on = getattr(payment, "payment_date", None) or (
            payment.paid_at.date() if payment.paid_at else None
        )

        return Response({
            "payment_id": str(payment.id),
            "receipt_number": getattr(payment, "receipt_number", None) or payment.reference_number or str(payment.id)[:8],
            "invoice_number": invoice.invoice_number,
            "student_name": getattr(student, "full_name", None) or f"{student.first_name} {student.last_name}",
            "admission_number": getattr(student, "admission_number", "") or "",
            "grade": getattr(getattr(student, "current_class", None), "name", "") or "",
            "payment_method": payment.payment_method,
            "reference_number": payment.reference_number or "",
            "amount": float(pay_amt),
            "payment_date": paid_on.isoformat() if paid_on else None,
            "paid_at": payment.paid_at,
            "invoice_amount_due": float(inv_due),
            "invoice_amount_paid": float(invoice.amount_paid or 0),
            "invoice_balance": float(invoice.balance or 0),
            "invoice_term": invoice.term or "",
            "invoice_year": invoice.academic_year or "",
            "line_items": lines,
            "notes": payment.notes or "",
            "school": {
                "name": getattr(school, "name", "") if school else "",
                "address": getattr(school, "address", "") if school else "",
                "phone": getattr(school, "phone", "") or getattr(school, "contact_phone", "") if school else "",
                "email": getattr(school, "email", "") or getattr(school, "contact_email", "") if school else "",
                "logo_url": logo_url,
                "currency": getattr(school, "currency", "KES") if school else "KES",
            },
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



def _clearance_structure_label(grade=None, term=None, year=None, raw_name=None):
    """One clean label: Grade · Term N · Year (no duplicated term/year)."""
    import re
    text_bits = [str(x).strip() for x in (grade, term, year, raw_name) if x and str(x).strip()]
    blob = " ".join(text_bits)

    g = (grade or "").strip() or None
    if not g and raw_name:
        # e.g. "PP2 – Term 3 – 2026" or "Grade 5 Term 2"
        m = re.match(
            r"^(PP\d|Grade\s*\d+|Nursery|Baby\s*Class|Playgroup)(?:\b|$)",
            str(raw_name).strip(),
            re.I,
        )
        if m:
            g = m.group(1).strip()

    term_s = None
    for candidate in (term, raw_name, blob):
        if not candidate:
            continue
        m = re.search(r"Term\s*([123])", str(candidate), re.I)
        if m:
            term_s = f"Term {m.group(1)}"
            break
        m = re.search(r"\b(T|Sem(?:ester)?)\s*([123])\b", str(candidate), re.I)
        if m:
            term_s = f"Term {m.group(2)}"
            break

    year_s = None
    for candidate in (year, raw_name, blob):
        if not candidate:
            continue
        m = re.search(r"(20\d{2})", str(candidate))
        if m:
            year_s = m.group(1)
            break

    parts = [p for p in (g, term_s, year_s) if p]
    if parts:
        return " · ".join(parts)
    if raw_name and str(raw_name).strip():
        return str(raw_name).strip()
    return g or "—"


class AwaitingClearanceView(APIView):
    """Students enrolled from admissions but not yet cleared by Finance."""
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get(self, request):
        """Light list — prepare billing only when cashier opens a student."""
        from apps.students.models import Student
        from apps.finance.models import Invoice
        from django.db.models import Sum, DecimalField, Value
        from django.db.models.functions import Coalesce

        school_ids = _resolve_school_ids(request)
        qs = list(
            Student.objects.filter(
                school_id__in=school_ids,
                status="PENDING_CLEARANCE",
            )
            .select_related("current_class", "fee_structure", "fee_structure__grade_level")
            .order_by("-admission_date")[:200]
        )
        ids = [s.id for s in qs]
        inv_map = {}
        inv_meta = {}  # student_id -> {term, academic_year} from first open invoice
        invoices_by_student = defaultdict(list)
        if ids:
            for row in (
                Invoice.objects.filter(student_id__in=ids)
                .values("student_id")
                .annotate(
                    total_due=Coalesce(Sum("amount_due"), Value(0), output_field=DecimalField()),
                    total_paid=Coalesce(Sum("amount_paid"), Value(0), output_field=DecimalField()),
                )
            ):
                inv_map[str(row["student_id"])] = row
            for inv in Invoice.objects.filter(student_id__in=ids).order_by("generated_at", "id"):
                sid = str(inv.student_id)
                invoices_by_student[sid].append(inv)
                if sid not in inv_meta:
                    inv_meta[sid] = {
                        "term": (inv.term or "").strip() or None,
                        "academic_year": (str(inv.academic_year or "").strip() or None),
                    }

        # Fallback structure via assignment or invoice → assignment
        assign_struct = {}
        if ids:
            from apps.finance.models import StudentFeeAssignment
            for a in (
                StudentFeeAssignment.objects.filter(student_id__in=ids)
                .select_related("fee_structure", "fee_structure__grade_level")
            ):
                if a.fee_structure_id:
                    assign_struct[str(a.student_id)] = a.fee_structure
            for inv in (
                Invoice.objects.filter(student_id__in=ids, fee_assignment__isnull=False)
                .select_related(
                    "fee_assignment__fee_structure",
                    "fee_assignment__fee_structure__grade_level",
                )
            ):
                sid = str(inv.student_id)
                if sid not in assign_struct and inv.fee_assignment_id:
                    fs = getattr(inv.fee_assignment, "fee_structure", None)
                    if fs is not None:
                        assign_struct[sid] = fs

        # Enrollment term/year from applications
        app_meta = {}
        if ids:
            try:
                from apps.admissions.models import Application
                for app in Application.objects.filter(student_id__in=ids).only(
                    "student_id", "enrollment_term", "enrollment_academic_year"
                ):
                    app_meta[str(app.student_id)] = {
                        "term": (app.enrollment_term or "").strip() or None,
                        "academic_year": (str(app.enrollment_academic_year or "").strip() or None),
                    }
            except Exception:
                pass

        rows = []
        from apps.finance.clearance import (
            _normalize_term_token,
            _normalize_year_token,
            fee_structure_matches,
        )

        for s in qs:
            agg = inv_map.get(str(s.id)) or {}
            due = float(agg.get("total_due") or 0)
            paid = float(agg.get("total_paid") or 0)
            meta = inv_meta.get(str(s.id)) or {}
            ameta = app_meta.get(str(s.id)) or {}
            if ameta.get("term") and ameta.get("academic_year"):
                period_invoices = [
                    invoice
                    for invoice in invoices_by_student.get(str(s.id), [])
                    if _normalize_term_token(invoice.term) == _normalize_term_token(ameta["term"])
                    and _normalize_year_token(invoice.academic_year)
                    == _normalize_year_token(ameta["academic_year"])
                ]
                due = sum(float(invoice.amount_due or 0) for invoice in period_invoices)
                paid = sum(float(invoice.amount_paid or 0) for invoice in period_invoices)
            fs = getattr(s, "fee_structure", None) or assign_struct.get(str(s.id))
            if fs and (ameta.get("term") or ameta.get("academic_year")) and not fee_structure_matches(
                s, fs, ameta.get("academic_year"), ameta.get("term")
            ):
                fs = None
            structure = None
            gname = getattr(getattr(s, "current_class", None), "name", None)
            term = ameta.get("term") or meta.get("term")
            year = ameta.get("academic_year") or meta.get("academic_year")
            if fs is not None:
                gname = getattr(getattr(fs, "grade_level", None), "name", None) or gname
                term = term or (fs.period_name or "").strip() or None
                year = year or (str(fs.academic_year or "").strip() or None)
            raw_name = getattr(fs, "name", None) if fs is not None else None
            display_name = _clearance_structure_label(
                grade=gname, term=term, year=year, raw_name=raw_name
            )
            # Normalize term/year for clients (single Term N / year only)
            import re as _re
            _tm = _re.search(r"Term\s*([123])", display_name or "", _re.I)
            term = f"Term {_tm.group(1)}" if _tm else term
            _ym = _re.search(r"(20\d{2})", display_name or "")
            year = _ym.group(1) if _ym else year
            if fs is not None:
                structure = {
                    "id": str(fs.id) if fs is not None else None,
                    "name": display_name,
                    "raw_name": raw_name,
                    "academic_year": year,
                    "period_name": term,
                    "grade": gname,
                    "total_amount": float(getattr(fs, "total_amount", 0) or 0) if fs else due,
                }

            rows.append({
                "id": str(s.id),
                "admission_number": s.admission_number,
                "full_name": getattr(s, "full_name", None) or f"{s.first_name} {s.last_name}",
                "first_name": s.first_name,
                "last_name": s.last_name,
                "grade": getattr(getattr(s, "current_class", None), "name", None),
                "grade_id": str(s.current_class_id) if s.current_class_id else None,
                "admission_date": s.admission_date.isoformat() if s.admission_date else None,
                "fee_structure_id": str(fs.id) if fs is not None else (
                    str(s.fee_structure_id) if getattr(s, "fee_structure_id", None) else None
                ),
                "structure": structure,
                "lines": [],
                "invoices": [],
                "total_due": due,
                "total_paid": paid,
                "balance": max(0.0, due - paid),
                "matched_year": year,
                "matched_term": term,
                "billing_error": None if (fs or due) else "No structure for grade",
                "billing_ready": bool(due or paid or fs),
            })
        return Response({"count": len(rows), "results": rows})


class ClearanceAddItemView(APIView):
    """Add extra fee line (uniform, assessment book, etc.) for a clearance student."""
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def post(self, request, student_id):
        from apps.students.models import Student
        from apps.finance.clearance import add_extra_fee_line

        school_ids = _resolve_school_ids(request)
        student = Student.objects.filter(pk=student_id, school_id__in=school_ids).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)
        try:
            line, inv, billing = add_extra_fee_line(
                student,
                description=request.data.get("description") or request.data.get("name"),
                amount=request.data.get("amount"),
                user=request.user,
                fee_item_id=request.data.get("fee_item_id"),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response({
            "line_id": str(line.id),
            "invoice_id": str(inv.id),
            "billing": billing,
        })



class ClearancePrepareView(APIView):
    """Run ensure_student_billing for one student when cashier opens the pay dialog."""
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get(self, request, student_id):
        from apps.students.models import Student
        from apps.finance.clearance import ensure_student_billing, fee_structure_matches

        school_ids = _resolve_school_ids(request)
        student = Student.objects.filter(id=student_id, school_id__in=school_ids).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)
        year = request.query_params.get("academic_year")
        term = request.query_params.get("term")
        structure_id = request.query_params.get("structure_id") or request.data.get("structure_id")
        if structure_id:
            from apps.finance.models import FeeStructure, StudentFeeAssignment
            fs = FeeStructure.objects.filter(id=structure_id, school_id=student.school_id).first()
            if not fs:
                return Response({"detail": "Fee structure not found for this school"}, status=404)
            if not year or not term:
                from apps.admissions.models import Application
                application = Application.objects.filter(student=student).first()
                if application:
                    year = year or application.enrollment_academic_year
                    term = term or application.enrollment_term
            if not fee_structure_matches(student, fs, year, term):
                return Response(
                    {"detail": "Fee structure must match the learner's grade, enrollment year, and term."},
                    status=400,
                )
            student.fee_structure = fs
            student.save(update_fields=["fee_structure"])
            assignment = StudentFeeAssignment.objects.filter(student=student).first()
            if assignment and assignment.fee_structure_id != fs.id:
                assignment.fee_structure = fs
                assignment.save(update_fields=["fee_structure"])
        try:
            billing = ensure_student_billing(
                student, user=request.user, academic_year=year, period_name=term
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(billing)


class ClearanceAdjustLineView(APIView):
    """Waive or discount a single invoice line during clearance."""
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def patch(self, request, line_id):
        from apps.finance.models import InvoiceLine
        from apps.finance.clearance import adjust_invoice_line, ensure_student_billing

        school_ids = _resolve_school_ids(request)
        line = (
            InvoiceLine.objects.select_related("invoice__student", "invoice__school")
            .filter(id=line_id)
            .first()
        )
        if not line:
            return Response({"detail": "Line not found"}, status=404)
        inv = line.invoice
        sid = getattr(inv, "school_id", None) or getattr(getattr(inv, "student", None), "school_id", None)
        if sid and sid not in school_ids:
            return Response({"detail": "Forbidden"}, status=403)

        waived = request.data.get("waived")
        discount = request.data.get("discount")
        reason = request.data.get("reason") or request.data.get("adjustment_reason") or ""

        if waived is not None and isinstance(waived, str):
            waived = waived.lower() in ("1", "true", "yes")

        try:
            adjust_invoice_line(
                line,
                waived=waived,
                discount=discount,
                reason=reason,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        line.refresh_from_db()
        inv.refresh_from_db()
        student = inv.student
        billing = ensure_student_billing(student, user=request.user) if student else {}
        return Response({
            "line": {
                "id": str(line.id),
                "description": line.description,
                "amount": float(line.amount or 0),
                "original_amount": float(line.original_amount or line.amount or 0),
                "discount_amount": float(line.discount_amount or 0),
                "is_waived": bool(line.is_waived),
                "adjustment_reason": line.adjustment_reason or "",
            },
            "invoice": {
                "id": str(inv.id),
                "amount_due": float(inv.amount_due or 0),
                "amount_paid": float(inv.amount_paid or 0),
                "balance": float(getattr(inv, "balance", 0) or max(0, float(inv.amount_due or 0) - float(inv.amount_paid or 0))),
            },
            "billing": billing,
        })
