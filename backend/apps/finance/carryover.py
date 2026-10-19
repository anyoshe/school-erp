"""
Fee arrears carry-over between terms and academic years.
"""
from decimal import Decimal
from datetime import date, timedelta
from django.db import transaction
from django.db.models import Sum


def student_outstanding(student) -> Decimal:
    from .models import Invoice
    total = (
        Invoice.objects.filter(student=student, is_paid=False)
        .aggregate(t=Sum("balance"))["t"]
        or Decimal("0")
    )
    return max(Decimal("0"), Decimal(str(total)))


def ensure_arrears_fee_item(school):
    from .models import FeeCategory, FeeItem
    cat, _ = FeeCategory.objects.get_or_create(
        school=school,
        name="Arrears / Balance Brought Forward",
        defaults={
            "description": "Unpaid balances carried from prior terms or years",
            "is_mandatory": True,
            "display_order": 0,
        },
    )
    item, _ = FeeItem.objects.get_or_create(
        category=cat,
        name="Balance brought forward",
        defaults={
            "description": "Outstanding school fees carried into a new term/year",
            "frequency": "one_time",
            "is_active": True,
            "is_optional": False,
        },
    )
    return item


@transaction.atomic
def carry_forward_outstanding(
    student,
    *,
    academic_year: str,
    term: str,
    note: str = "",
    user=None,
    close_source_invoices: bool = True,
):
    """
    Move unpaid invoice balances onto a new arrears invoice for the target
    academic_year/term. Source invoices are closed via TRANSFER payments so
    balances are not double-counted.
    """
    from .models import Invoice, InvoiceLine, Payment, StudentFeeAssignment

    amount = student_outstanding(student)
    if amount <= 0:
        return None

    assignment = StudentFeeAssignment.objects.filter(student=student).first()
    if not assignment:
        assignment = StudentFeeAssignment.objects.create(
            student=student,
            fee_structure=getattr(student, "fee_structure", None),
            assigned_by=user,
        )

    max_inst = (
        Invoice.objects.filter(student=student, fee_assignment=assignment)
        .order_by("-installment_number")
        .values_list("installment_number", flat=True)
        .first()
    ) or 0

    due = date.today() + timedelta(days=14)
    inv = Invoice.objects.create(
        student=student,
        school=student.school,
        fee_assignment=assignment,
        installment_number=max(int(max_inst) + 1, 90),
        due_date=due,
        term=str(term)[:20],
        academic_year=str(academic_year)[:9],
        amount_due=amount,
        amount_paid=Decimal("0"),
        balance=amount,
        generated_by=user,
    )

    item = ensure_arrears_fee_item(student.school)
    InvoiceLine.objects.create(
        invoice=inv,
        item=item,
        description=(note or f"Balance brought forward ({amount})")[:200],
        amount=amount,
    )

    if close_source_invoices:
        open_invoices = Invoice.objects.filter(student=student, is_paid=False).exclude(id=inv.id)
        for old in open_invoices:
            bal = Decimal(str(old.balance or 0))
            if bal <= 0:
                continue
            Payment.objects.create(
                school=student.school,
                invoice=old,
                amount=bal,
                payment_method="TRANSFER",
                reference_number=f"BF-{inv.invoice_number}"[:100],
                notes=f"Balance transferred to {inv.invoice_number}",
            )

    return inv
