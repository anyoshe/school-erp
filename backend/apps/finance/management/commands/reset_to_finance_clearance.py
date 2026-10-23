"""
Option 2: wipe school-fee Payment noise for enrolled students, reset invoices,
and place every student on PENDING_CLEARANCE so Finance collects afresh.

Does NOT delete students or applications. Does NOT delete interview/admission IncomeReceipts.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum


class Command(BaseCommand):
    help = "Reset enrolled students to Finance clearance (wipe school-fee payments, keep student records)"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment
        from apps.finance.models import Invoice, Payment
        from apps.students.models import Student

        dry = options["dry_run"]
        school_id = (options.get("school_id") or "").strip()

        pay_qs = Payment.objects.exclude(payment_method="TRANSFER")
        if school_id:
            pay_qs = pay_qs.filter(school_id=school_id)
        n_pay = pay_qs.count()
        self.stdout.write(f"Will delete {n_pay} school-fee Payment rows")
        if not dry:
            pay_qs.delete()

        # Optional: clear legacy AdmissionFeePayment (was mixed school fees)
        adm_qs = AdmissionFeePayment.objects.all()
        if school_id:
            adm_qs = adm_qs.filter(application__school_id=school_id)
        n_adm = adm_qs.count()
        self.stdout.write(f"Will delete {n_adm} AdmissionFeePayment rows (legacy)")
        if not dry:
            adm_qs.delete()

        inv_qs = Invoice.objects.all()
        if school_id:
            inv_qs = inv_qs.filter(school_id=school_id)
        for inv in inv_qs.iterator():
            due = Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
            if not dry:
                Invoice.objects.filter(pk=inv.pk).update(
                    amount_paid=Decimal("0"),
                    balance=due,
                    is_paid=False,
                    paid_at=None,
                )
        self.stdout.write(f"Reset {inv_qs.count()} invoices to unpaid")

        stu = Student.objects.all()
        if school_id:
            stu = stu.filter(school_id=school_id)
        n = stu.count()
        if not dry:
            stu.update(status="PENDING_CLEARANCE")
        self.stdout.write(self.style.SUCCESS(
            f"Students set to PENDING_CLEARANCE: {n}"
            + (" (dry-run)" if dry else "")
        ))
