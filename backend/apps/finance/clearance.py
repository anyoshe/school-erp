"""
Finance clearance: auto-match fee structure by grade/year/term and support extra fee lines.
"""
from decimal import Decimal
from django.db.models import Q, Sum
from django.utils import timezone


def _detect_year_term(school):
    year = str(timezone.now().year)
    term = "Term 1"
    try:
        from apps.academics.models import AcademicYear, Term
        from django.db.models import Q
        ay = (
            AcademicYear.objects.filter(Q(school=school) | Q(school_id=school.id), is_active=True).first()
            or AcademicYear.objects.filter(Q(school=school) | Q(school_id=school.id)).order_by("-start_date").first()
        )
        if ay:
            year = getattr(ay, "name", None) or str(getattr(ay, "start_date", "") or year)[:9]
            year = str(year)[:9]
            today = timezone.now().date()
            t = (
                Term.objects.filter(academic_year=ay, start_date__lte=today, end_date__gte=today).first()
                or Term.objects.filter(academic_year=ay).order_by("order", "start_date").first()
            )
            if t:
                term = t.name or term
    except Exception:
        pass
    return year, term


def find_fee_structure(student, academic_year=None, period_name=None):
    from .models import FeeStructure

    school = student.school
    grade = student.current_class
    if not grade:
        return None
    year, term = _detect_year_term(school)
    academic_year = academic_year or year
    period_name = period_name or term

    qs = FeeStructure.objects.filter(
        school=school,
        grade_level=grade,
        is_active=True,
    ).prefetch_related("structure_items__item")

    # Prefer exact year + period
    exact = qs.filter(academic_year=academic_year, period_name__icontains=period_name.split()[-1] if period_name else "").first()
    if exact:
        return exact
    exact = qs.filter(academic_year=academic_year).filter(
        Q(period_name__iexact=period_name) | Q(period_name__icontains=period_name)
    ).first()
    if exact:
        return exact
    # Same grade any period this year
    by_year = qs.filter(academic_year=academic_year).order_by("period_name").first()
    if by_year:
        return by_year
    # Latest structure for grade
    return qs.order_by("-academic_year", "period_name").first()


def ensure_student_billing(student, user=None, academic_year=None, period_name=None):
    """
    Ensure StudentFeeAssignment + at least one Invoice with lines exist for clearance.
    Returns dict with structure, assignment, invoices, lines summary.
    """
    from .models import (
        FeeStructure,
        StudentFeeAssignment,
        Invoice,
        InvoiceLine,
        Payment,
    )
    from .signals import create_invoice_lines_for_assignment

    structure = student.fee_structure
    if structure is None:
        structure = find_fee_structure(student, academic_year, period_name)
        if structure:
            student.fee_structure = structure
            student.save(update_fields=["fee_structure"])

    assignment = getattr(student, "fee_assignment", None)
    if assignment is None and structure is not None:
        assignment, _ = StudentFeeAssignment.objects.get_or_create(
            student=student,
            defaults={
                "fee_structure": structure,
                "assigned_by": user if getattr(user, "is_authenticated", False) else None,
            },
        )
        if assignment.fee_structure_id != structure.id:
            assignment.fee_structure = structure
            assignment.save(update_fields=["fee_structure"])

    year, term = _detect_year_term(student.school)
    year = academic_year or (structure.academic_year if structure else year)
    term = period_name or (structure.period_name if structure else term)

    invoices = list(Invoice.objects.filter(student=student).order_by("due_date", "generated_at"))
    if not invoices and assignment and structure:
        total = structure.total_amount or Decimal("0")
        # Signal may also fire on assignment create — avoid duplicate
        if not Invoice.objects.filter(student=student, fee_assignment=assignment).exists():
            inv = Invoice.objects.create(
                student=student,
                fee_assignment=assignment,
                school=student.school,
                term=term,
                academic_year=str(year)[:9],
                amount_due=total,
                due_date=timezone.now().date(),
                generated_by=user if getattr(user, "is_authenticated", False) else None,
            )
            try:
                create_invoice_lines_for_assignment(inv, assignment, Decimal("1"))
            except Exception:
                for si in structure.structure_items.select_related("item").all():
                    InvoiceLine.objects.create(
                        invoice=inv,
                        item=si.item,
                        description=getattr(si.item, "name", "Fee") or "Fee",
                        amount=si.amount,
                    )
            invoices = [inv]

    # Build line preview
    lines = []
    for inv in invoices:
        for ln in inv.lines.select_related("item").all():
            lines.append({
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "line_id": str(ln.id),
                "description": ln.description,
                "amount": float(ln.amount or 0),
                "item_id": str(ln.item_id) if ln.item_id else None,
                "term": inv.term,
                "academic_year": inv.academic_year,
            })

    paid = (
        Payment.objects.filter(invoice__student=student)
        .exclude(payment_method="TRANSFER")
        .aggregate(t=Sum("amount"))["t"]
        or Decimal("0")
    )
    due = sum(
        (Decimal(str(i.amount_due or 0)) + Decimal(str(i.late_fee_applied or 0)) for i in invoices),
        Decimal("0"),
    )

    return {
        "structure": {
            "id": str(structure.id),
            "name": structure.name,
            "academic_year": structure.academic_year,
            "period_name": structure.period_name,
            "total_amount": float(structure.total_amount or 0),
        } if structure else None,
        "assignment_id": str(assignment.id) if assignment else None,
        "invoices": [
            {
                "id": str(i.id),
                "invoice_number": i.invoice_number,
                "term": i.term,
                "academic_year": i.academic_year,
                "amount_due": float(i.amount_due or 0),
                "amount_paid": float(i.amount_paid or 0),
                "balance": float(getattr(i, "balance", 0) or max(0, float(i.amount_due or 0) - float(i.amount_paid or 0))),
            }
            for i in invoices
        ],
        "lines": lines,
        "total_due": float(due),
        "total_paid": float(paid),
        "balance": float(max(Decimal("0"), due - paid)),
        "matched_year": str(year),
        "matched_term": term,
    }


def add_extra_fee_line(student, description, amount, user=None, fee_item_id=None):
    """
    Add a one-off fee line (uniform, assessment book, etc.) onto the student's open invoice.
    Creates invoice via ensure_student_billing if needed.
    """
    from .models import FeeItem, FeeCategory, Invoice, InvoiceLine

    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Amount must be positive")
    description = (description or "").strip()
    if not description:
        raise ValueError("Description is required")

    billing = ensure_student_billing(student, user=user)
    invoices = Invoice.objects.filter(student=student).order_by("due_date", "generated_at")
    inv = invoices.first()
    if not inv:
        raise ValueError("No invoice available — create a fee structure for this grade first")

    item = None
    if fee_item_id:
        item = FeeItem.objects.filter(pk=fee_item_id).first()
    if item is None:
        # Ensure a misc category + item for extras
        cat, _ = FeeCategory.objects.get_or_create(
            school=student.school,
            name="Additional charges",
            defaults={"is_mandatory": True, "display_order": 99},
        )
        item, _ = FeeItem.objects.get_or_create(
            category=cat,
            name=description[:100],
            defaults={"is_optional": True, "description": description},
        )

    line = InvoiceLine.objects.create(
        invoice=inv,
        item=item,
        description=description,
        amount=amount,
    )
    inv.amount_due = Decimal(str(inv.amount_due or 0)) + amount
    inv.save()  # refreshes balance

    return line, inv, ensure_student_billing(student, user=user)
