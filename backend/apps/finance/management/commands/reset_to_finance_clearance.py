"""
Reset enrolled students to a clean Finance-clearance state.

- Deletes school-fee Payment rows
- Deletes legacy AdmissionFeePayment rows  
- Deletes invoices (and optional fee assignments) so Total Invoiced is 0
  until Finance assigns structures and collects
- Sets every student to PENDING_CLEARANCE

Does NOT delete students or applications.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Wipe fee payments/invoices and put students on Finance clearance"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")
        parser.add_argument(
            "--keep-invoices",
            action="store_true",
            help="Only zero payments; keep existing invoices",
        )
        parser.add_argument(
            "--keep-assignments",
            action="store_true",
            help="Keep StudentFeeAssignment rows when wiping invoices",
        )

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment
        from apps.finance.models import Invoice, Payment, StudentFeeAssignment
        from apps.students.models import Student

        dry = options["dry_run"]
        school_id = (options.get("school_id") or "").strip()
        keep_inv = options["keep_invoices"]
        keep_asg = options["keep_assignments"]

        pay_qs = Payment.objects.exclude(payment_method="TRANSFER")
        if school_id:
            pay_qs = pay_qs.filter(school_id=school_id)
        self.stdout.write(f"Delete Payment rows: {pay_qs.count()}")
        if not dry:
            pay_qs.delete()

        adm_qs = AdmissionFeePayment.objects.all()
        if school_id:
            adm_qs = adm_qs.filter(application__school_id=school_id)
        self.stdout.write(f"Delete AdmissionFeePayment rows: {adm_qs.count()}")
        if not dry:
            adm_qs.delete()

        inv_qs = Invoice.objects.all()
        if school_id:
            inv_qs = inv_qs.filter(school_id=school_id)

        if keep_inv:
            for inv in inv_qs.iterator():
                due = Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
                if not dry:
                    Invoice.objects.filter(pk=inv.pk).update(
                        amount_paid=Decimal("0"),
                        balance=due,
                        is_paid=False,
                        paid_at=None,
                    )
            self.stdout.write(f"Zeroed invoices: {inv_qs.count()}")
        else:
            n = inv_qs.count()
            if not dry:
                inv_qs.delete()
            self.stdout.write(f"Deleted invoices: {n}")

        if not keep_asg and not keep_inv:
            asg = StudentFeeAssignment.objects.all()
            if school_id:
                asg = asg.filter(student__school_id=school_id)
            n = asg.count()
            if not dry:
                asg.delete()
            self.stdout.write(f"Deleted fee assignments: {n}")
            # clear student.fee_structure link so Finance re-assigns
            stu_fs = Student.objects.all()
            if school_id:
                stu_fs = stu_fs.filter(school_id=school_id)
            if not dry:
                stu_fs.update(fee_structure=None)
            self.stdout.write("Cleared student.fee_structure links")

        stu = Student.objects.all()
        if school_id:
            stu = stu.filter(school_id=school_id)
        n = stu.count()
        if not dry:
            stu.update(status="PENDING_CLEARANCE")
        self.stdout.write(self.style.SUCCESS(
            f"Students PENDING_CLEARANCE: {n}" + (" (dry-run)" if dry else "")
        ))
