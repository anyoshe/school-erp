
"""
Reconcile enrollment school-fee money onto Finance Payment rows (no double count).

1) Delete Payment rows from failed backfill (notes contain "backfill")
2) For each enrolled application, target paid = sum(AdmissionFeePayment)
   existing = sum(Payment on student invoices)
   post shortfall once across invoices (by amount_due), ignoring wrong balance flags
3) Rebuild every invoice.amount_paid / balance from Payment sums
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum


class Command(BaseCommand):
    help = "Reconcile enrollment fee collections to Payment rows and rebuild invoice paid totals"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment, Application
        from apps.finance.models import Invoice, Payment, StudentFeeAssignment

        dry = options["dry_run"]
        school_id = (options.get("school_id") or "").strip()

        removed = 0
        posted = 0
        no_invoice = 0

        bf = Payment.objects.filter(notes__icontains="backfill")
        if school_id:
            bf = bf.filter(school_id=school_id)
        for p in list(bf):
            self.stdout.write(f"{'[dry] ' if dry else ''}DELETE backfill {p.amount} inv={p.invoice_id}")
            if not dry:
                p.delete()
            removed += 1

        apps = Application.objects.filter(student__isnull=False).select_related("student", "school")
        if school_id:
            apps = apps.filter(school_id=school_id)

        for app in apps.iterator():
            student = app.student
            adm_total = (
                AdmissionFeePayment.objects.filter(application=app).aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            if adm_total <= 0:
                continue

            existing = (
                Payment.objects.filter(invoice__student=student)
                .exclude(payment_method="TRANSFER")
                .aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            shortfall = adm_total - existing
            self.stdout.write(
                f"{student.admission_number}: admission_rows={adm_total} "
                f"payments={existing} shortfall={shortfall}"
            )
            if shortfall <= 0:
                continue

            invoices = list(
                Invoice.objects.filter(student=student).order_by("due_date", "generated_at", "id")
            )
            if not invoices:
                fs_id = getattr(student, "fee_structure_id", None)
                if fs_id and not dry:
                    try:
                        assignment, _ = StudentFeeAssignment.objects.get_or_create(
                            student=student,
                            defaults={"fee_structure_id": fs_id},
                        )
                        try:
                            from apps.finance.signals import regenerate_invoices_for_assignment
                            regenerate_invoices_for_assignment(assignment)
                        except Exception as e:
                            self.stderr.write(f"regen invoices: {e}")
                        invoices = list(
                            Invoice.objects.filter(student=student).order_by(
                                "due_date", "generated_at", "id"
                            )
                        )
                    except Exception as e:
                        self.stderr.write(f"assign {student.admission_number}: {e}")

            if not invoices:
                no_invoice += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"NO INVOICE {student.admission_number} {student.full_name} "
                        f"cannot post {shortfall}"
                    )
                )
                continue

            # Distribute shortfall across invoices by remaining capacity (due - payment sum)
            remaining = shortfall
            for inv in invoices:
                if remaining <= 0:
                    break
                paid = (
                    Payment.objects.filter(invoice=inv)
                    .exclude(payment_method="TRANSFER")
                    .aggregate(t=Sum("amount"))["t"]
                    or Decimal("0")
                )
                due = Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
                room = due - paid
                # If due is 0 but we still have shortfall, put all on first invoice
                if room <= 0 and inv != invoices[-1]:
                    continue
                if room <= 0:
                    pay_amt = remaining
                else:
                    pay_amt = min(remaining, room)

                self.stdout.write(
                    f"{'[dry] ' if dry else ''}POST {pay_amt} → {inv.invoice_number} "
                    f"({student.admission_number})"
                )
                if not dry:
                    # Create without double-bump confusion: use objects.create then rebuild
                    Payment.objects.create(
                        school=app.school,
                        invoice=inv,
                        amount=pay_amt,
                        payment_method="CASH",
                        notes=(
                            "Enrollment school fee (reconcile once) "
                            f"application={app.id}"
                        ),
                    )
                posted += 1
                remaining -= pay_amt

        # Rebuild all invoice paid totals from Payment
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
            balance = max(Decimal("0"), due - paid)
            if not dry:
                Invoice.objects.filter(pk=inv.pk).update(
                    amount_paid=paid,
                    balance=balance,
                    is_paid=(due > 0 and paid >= due),
                )

        pay_qs = Payment.objects.exclude(payment_method="TRANSFER")
        if school_id:
            pay_qs = pay_qs.filter(school_id=school_id)
        total_pay = pay_qs.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        total_due = inv_qs.aggregate(t=Sum("amount_due"))["t"] or Decimal("0")
        total_paid_field = inv_qs.aggregate(t=Sum("amount_paid"))["t"] or Decimal("0")

        self.stdout.write(self.style.SUCCESS(
            f"Done removed_backfill={removed} posted={posted} no_invoice={no_invoice}\n"
            f"TOTALS payment_sum={total_pay} invoice_due_sum={total_due} "
            f"invoice_amount_paid_sum={total_paid_field}"
            + (" (dry-run)" if dry else "")
        ))
