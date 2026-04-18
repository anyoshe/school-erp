"""
Signals for Finance module - Auto-generate invoices when StudentFeeAssignment is created
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
from .models import StudentFeeAssignment, Invoice, InvoiceLine


def create_invoice_lines_for_assignment(invoice, assignment, proportion=1):
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


def regenerate_invoices_for_assignment(assignment, academic_year=None):
    """Delete existing invoices and create fresh invoices for the current assignment state."""
    print(f"[INVOICE SIGNAL] Regenerating invoices for assignment {assignment.id}")

    Invoice.objects.filter(fee_assignment=assignment).delete()

    plan = assignment.payment_plan
    start_date = timezone.now().date()
    academic_year = academic_year or getattr(assignment.fee_structure, 'academic_year', "2026")
    term = getattr(assignment.fee_structure, 'period_name', "Term 1")

    effective_total = assignment.remaining_total or Decimal('0')

    if effective_total <= 0:
        print("[INVOICE SIGNAL] Remaining total is 0 → no invoices created")
        return 0

    print(f"[INVOICE SIGNAL] Creating invoices for {effective_total} using plan: {plan}")

    if not plan or plan.number_of_installments <= 1 or getattr(plan, 'plan_type', '').lower() == 'custom':
        due_date = start_date + timedelta(days=14)
        if plan and plan.days_interval:
            due_date = start_date + timedelta(days=plan.days_interval)
        if plan and getattr(plan, 'plan_type', '').lower() == 'custom' and getattr(assignment, 'custom_due_date', None):
            due_date = assignment.custom_due_date

        invoice = Invoice.objects.create(
            student=assignment.student,
            fee_assignment=assignment,
            school=assignment.student.school,
            payment_plan=plan,
            term=term,
            academic_year=academic_year,
            amount_due=effective_total,
            due_date=due_date,
            generated_by=None,
        )
        create_invoice_lines_for_assignment(invoice, assignment, Decimal('1'))
        print(f"[INVOICE SIGNAL] Created 1 custom/partial invoice of {effective_total}")
        return 1

    num_installments = plan.number_of_installments
    amount_per_installment = (effective_total / Decimal(num_installments)).quantize(
        Decimal('0.01'), rounding='ROUND_HALF_UP'
    )

    interval_map = {
        'weekly': 7,
        'monthly': 30,
        'quarterly': 90,
        'semester': 120,
        'termly': 120,
    }
    days_step = plan.days_interval or interval_map.get(getattr(plan, 'plan_type', '').lower(), 30)

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
            generated_by=None,
        )
        proportion = (invoice.amount_due / effective_total) if effective_total else Decimal('0')
        create_invoice_lines_for_assignment(invoice, assignment, proportion)

    print(f"[INVOICE SIGNAL] Created {num_installments} installment invoices")
    return num_installments


@receiver(post_save, sender=StudentFeeAssignment, dispatch_uid="unique_auto_generate_invoices")
def auto_generate_invoices_on_assignment(sender, instance, created, **kwargs):
    print(f"[INVOICE SIGNAL] Fired for assignment {instance.id} (created={created})")
    
    if not created:
        print("[INVOICE SIGNAL] Not a creation event → skipping")
        return

    regenerate_invoices_for_assignment(instance)
