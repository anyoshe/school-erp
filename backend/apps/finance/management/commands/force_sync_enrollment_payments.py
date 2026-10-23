"""
One-shot: make Finance Payment rows match money already taken at enrollment.

For each enrolled student:
  target = max(
    sum(AdmissionFeePayment on their application),
    sum(invoice amount_due) if invoices look fully settled (balance 0 / is_paid)
      but Payment sum is less  — common when amount_paid was wrong
  )
  post (target - existing Payment sum) once across invoices.

Then rebuild every invoice.amount_paid from Payment.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum


class Command(BaseCommand):
    help = "Force-create missing school-fee Payment rows from enrollment collections"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment, Application
        from apps.finance.models import Invoice, Payment
        from apps.students.models import Student

        dry = options["dry_run"]
        school_id = (options.get("school_id") or "").strip()

        # Remove prior bad backfill/reconcile duplicates first
        junk = Payment.objects.filter(
            notes__icontains="backfill"
        ) | Payment.objects.filter(notes__icontains="reconcile once")
        if school_id:
            junk = junk.filter(school_id=school_id)
        junk_count = junk.count()
        if not dry:
            junk.delete()
        self.stdout.write(f"Cleared junk payment rows: {junk_count}")

        students = Student.objects.all()
        if school_id:
            students = students.filter(school_id=school_id)

        posted = 0
        for student in students.iterator():
            app = Application.objects.filter(student=student).first()
            adm = Decimal("0")
            if app:
                adm = (
                    AdmissionFeePayment.objects.filter(application=app).aggregate(
                        t=Sum("amount")
                    )["t"]
                    or Decimal("0")
                )

            invoices = list(
                Invoice.objects.filter(student=student).order_by("due_date", "generated_at", "id")
            )
            if not invoices:
                if adm > 0:
                    self.stdout.write(
                        self.style.WARNING(
                            f"{student.admission_number}: has admission money {adm} but NO invoices"
                        )
                    )
                continue

            due_total = sum(
                (Decimal(str(i.amount_due or 0)) + Decimal(str(i.late_fee_applied or 0)) for i in invoices),
                Decimal("0"),
            )
            pay_total = (
                Payment.objects.filter(invoice__student=student)
                .exclude(payment_method="TRANSFER")
                .aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )

            # If invoices claim settled but payments lag, trust billed amount as collected target
            looks_settled = all(
                bool(getattr(i, "is_paid", False))
                or Decimal(str(getattr(i, "balance", 0) or 0)) <= 0
                for i in invoices
            )
            target = adm
            if looks_settled and due_total > target:
                target = due_total
            # Never target more than billed
            if due_total > 0:
                target = min(target, due_total) if target > 0 else (
                    due_total if looks_settled and pay_total < due_total else target
                )

            # Fallback: if adm is 0 but settled invoices underpaid in Payment table
            if target <= 0 and looks_settled and pay_total < due_total:
                target = due_total

            shortfall = target - pay_total
            self.stdout.write(
                f"{student.admission_number}: due={due_total} pay={pay_total} "
                f"adm={adm} target={target} shortfall={shortfall}"
            )
            if shortfall <= 0:
                continue

            remaining = shortfall
            for inv in invoices:
                if remaining <= 0:
                    break
                inv_due = Decimal(str(inv.amount_due or 0)) + Decimal(
                    str(inv.late_fee_applied or 0)
                )
                inv_paid = (
                    Payment.objects.filter(invoice=inv)
                    .exclude(payment_method="TRANSFER")
                    .aggregate(t=Sum("amount"))["t"]
                    or Decimal("0")
                )
                room = inv_due - inv_paid
                if room <= 0 and inv is not invoices[-1]:
                    continue
                pay_amt = remaining if room <= 0 else min(remaining, room)
                if pay_amt <= 0:
                    continue
                self.stdout.write(
                    f"  {'[dry] ' if dry else ''}POST {pay_amt} → {inv.invoice_number}"
                )
                if not dry:
                    Payment.objects.create(
                        school=student.school,
                        invoice=inv,
                        amount=pay_amt,
                        payment_method="CASH",
                        notes=f"Enrollment collection sync application={getattr(app, 'id', '')}",
                    )
                posted += 1
                remaining -= pay_amt

        # Rebuild invoice paid fields
        inv_qs = Invoice.objects.all()
        if school_id:
            inv_qs = inv_qs.filter(school_id=school_id)
        for inv in inv_qs.iterator():
            paid = (
                Payment.objects.filter(invoice=inv)
                .exclude(payment_method="TRANSFER")
                .aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            due = Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
            if not dry:
                Invoice.objects.filter(pk=inv.pk).update(
                    amount_paid=paid,
                    balance=max(Decimal("0"), due - paid),
                    is_paid=(due > 0 and paid >= due),
                )

        total = (
            Payment.objects.exclude(payment_method="TRANSFER")
            .filter(**({"school_id": school_id} if school_id else {}))
            .aggregate(t=Sum("amount"))["t"]
            or Decimal("0")
        )
        due_sum = inv_qs.aggregate(t=Sum("amount_due"))["t"] or Decimal("0")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done posted={posted} TOTAL_PAYMENTS={total} TOTAL_INVOICED={due_sum}"
                + (" (dry-run)" if dry else "")
            )
        )
