"""
Backfill finance.Payment for enrollment school-fee deposits that only
exist as AdmissionFeePayment rows.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = "Post missing enrollment deposits onto student invoices"

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment, Application
        from apps.finance.models import Invoice, Payment
        from apps.finance.pre_enrollment import post_charge_to_finance

        created_pay = 0
        posted_income = 0

        # 1) School fee deposits -> invoice payments
        qs = AdmissionFeePayment.objects.select_related("application", "application__student").filter(
            Q(payment_method__icontains="enrollment")
            | Q(payment_method__icontains="school fee")
            | Q(payment_method__icontains="Initial")
        )
        for row in qs:
            app = row.application
            student = getattr(app, "student", None)
            if not student:
                continue
            invoice = Invoice.objects.filter(student=student).order_by("due_date", "id").first()
            if not invoice:
                continue
            if Payment.objects.filter(invoice=invoice, notes__icontains="Enrollment school fee deposit").exists():
                continue
            if Payment.objects.filter(invoice=invoice, reference_number=row.receipt_number or "", amount=row.amount).exists():
                continue
            amt = Decimal(str(row.amount or 0))
            if amt <= 0:
                continue
            pay_amt = min(amt, Decimal(str(invoice.current_total_due or invoice.amount_due or amt)))
            Payment.objects.create(
                school=app.school,
                invoice=invoice,
                amount=pay_amt,
                payment_method="CASH",
                reference_number=(row.receipt_number or "")[:100],
                notes="Enrollment school fee deposit (backfill)",
            )
            created_pay += 1

        # 2) Paid interview/admission charges -> income receipts
        from apps.admissions.models import ApplicationCharge
        for ch in ApplicationCharge.objects.select_related("application", "application__student").filter(amount_paid__gt=0):
            try:
                r = post_charge_to_finance(ch, student=getattr(ch.application, "student", None))
                if r:
                    posted_income += 1
            except Exception as e:
                self.stderr.write(str(e))

        self.stdout.write(self.style.SUCCESS(
            f"Backfill done: {created_pay} invoice payments, {posted_income} income receipts processed"
        ))
