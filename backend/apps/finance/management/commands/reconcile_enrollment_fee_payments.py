"""
Fix double-counted admission backfills and missing enrollment school-fee payments.

1) Remove Payment rows created by backfill (notes contain "backfill")
2) Rebuild each invoice.amount_paid from real Payment sums
3) For each enrolled student, ensure school-fee Payments cover AdmissionFeePayment totals
   (once only) by posting the shortfall onto invoices
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.db.models import F


class Command(BaseCommand):
    help = "Reconcile enrollment/admission fee money onto invoices without double counting"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment, Application
        from apps.finance.models import Invoice, Payment, StudentFeeAssignment
        from apps.students.models import Student

        dry = options["dry_run"]
        school_id = (options.get("school_id") or "").strip()

        removed = 0
        rebuilt = 0
        posted = 0
        no_invoice = 0

        # ── 1) Remove backfill duplicates ───────────────────────────────────
        bf = Payment.objects.filter(notes__icontains="backfill")
        if school_id:
            bf = bf.filter(school_id=school_id)
        bf = list(bf.select_related("invoice"))
        for p in bf:
            self.stdout.write(
                f"{'[dry] ' if dry else ''}Remove backfill payment "
                f"{p.amount} on invoice {getattr(p.invoice, 'invoice_number', p.invoice_id)}"
            )
            if not dry:
                inv = p.invoice
                # Reverse inflated amount_paid before delete
                Payment.objects.filter(pk=p.pk).delete()
                # amount_paid will be rebuilt in step 2
            removed += 1

        # ── 2) Rebuild amount_paid / balance from Payment rows ─────────────
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
            is_paid = paid >= due and due > 0
            if dry:
                if Decimal(str(inv.amount_paid or 0)) != paid:
                    self.stdout.write(
                        f"[dry] Rebuild {inv.invoice_number}: amount_paid "
                        f"{inv.amount_paid} → {paid}"
                    )
            else:
                Invoice.objects.filter(pk=inv.pk).update(
                    amount_paid=paid,
                    balance=balance,
                    is_paid=is_paid,
                )
            rebuilt += 1

        # ── 3) Post missing enrollment collections once ────────────────────
        apps = Application.objects.filter(student__isnull=False).select_related(
            "student", "school"
        )
        if school_id:
            apps = apps.filter(school_id=school_id)

        for app in apps.iterator():
            student = app.student
            if not student:
                continue

            adm_total = (
                AdmissionFeePayment.objects.filter(application=app).aggregate(
                    t=Sum("amount")
                )["t"]
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

            # Target: at least adm_total recognized as school-fee payments.
            # If finance later collected more, keep the higher existing total.
            shortfall = adm_total - existing
            if shortfall <= 0:
                self.stdout.write(
                    f"OK {student.admission_number}: payments={existing} "
                    f"admission_rows={adm_total} (no shortfall)"
                )
                continue

            invoices = list(
                Invoice.objects.filter(student=student).order_by("due_date", "generated_at", "id")
            )
            if not invoices:
                fs = getattr(student, "fee_structure", None)
                if fs and not dry:
                    try:
                        assignment, _ = StudentFeeAssignment.objects.get_or_create(
                            student=student,
                            defaults={"fee_structure": fs},
                        )
                        # Prefer signal/regen if available
                        try:
                            from apps.finance.signals import regenerate_invoices_for_assignment
                            regenerate_invoices_for_assignment(assignment)
                        except Exception:
                            pass
                        invoices = list(
                            Invoice.objects.filter(student=student).order_by(
                                "due_date", "generated_at", "id"
                            )
                        )
                    except Exception as e:
                        self.stderr.write(f"Assign failed {student.admission_number}: {e}")

            if not invoices:
                no_invoice += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"No invoice for {student.admission_number} ({student.full_name}) "
                        f"— shortfall {shortfall}. Assign fee structure in Finance."
                    )
                )
                continue

            remaining = shortfall
            for inv in invoices:
                if remaining <= 0:
                    break
                # refresh paid from payments
                paid = (
                    Payment.objects.filter(invoice=inv)
                    .exclude(payment_method="TRANSFER")
                    .aggregate(t=Sum("amount"))["t"]
                    or Decimal("0")
                )
                due = Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
                outstanding = max(Decimal("0"), due - paid)
                if outstanding <= 0:
                    continue
                pay_amt = min(remaining, outstanding)
                self.stdout.write(
                    f"{'[dry] ' if dry else ''}Post missing {pay_amt} → "
                    f"{inv.invoice_number} ({student.admission_number})"
                )
                if not dry:
                    Payment.objects.create(
                        school=app.school,
                        invoice=inv,
                        amount=pay_amt,
                        payment_method="CASH",
                        reference_number="",
                        notes=(
                            "Enrollment school fee deposit (reconcile) "
                            f"application={app.id}"
                        ),
                    )
                    # Payment.save already bumps amount_paid — rebuild later
                posted += 1
                remaining -= pay_amt

            if remaining > 0:
                inv = invoices[0]
                self.stdout.write(
                    f"{'[dry] ' if dry else ''}Post remaining {remaining} → "
                    f"{inv.invoice_number} ({student.admission_number})"
                )
                if not dry:
                    Payment.objects.create(
                        school=app.school,
                        invoice=inv,
                        amount=remaining,
                        payment_method="CASH",
                        notes=(
                            "Enrollment school fee deposit surplus (reconcile) "
                            f"application={app.id}"
                        ),
                    )
                posted += 1

        # ── 4) Final rebuild of amount_paid after new posts ────────────────
        if not dry:
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
                Invoice.objects.filter(pk=inv.pk).update(
                    amount_paid=paid,
                    balance=balance,
                    is_paid=(paid >= due and due > 0),
                )

        # Totals report
        pay_qs = Payment.objects.exclude(payment_method="TRANSFER")
        inv_qs = Invoice.objects.all()
        if school_id:
            pay_qs = pay_qs.filter(school_id=school_id)
            inv_qs = inv_qs.filter(school_id=school_id)
        total_payments = pay_qs.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        total_invoiced = inv_qs.aggregate(t=Sum("amount_due"))["t"] or Decimal("0")
        total_invoice_paid = inv_qs.aggregate(t=Sum("amount_paid"))["t"] or Decimal("0")

        self.stdout.write(self.style.SUCCESS(
            f"Done. removed_backfill={removed} invoices_touched={rebuilt} "
            f"posted_missing={posted} still_no_invoice={no_invoice}\n"
            f"CHECK totals: payment_rows_sum={total_payments} "
            f"invoice_amount_paid_sum={total_invoice_paid} "
            f"invoice_amount_due_sum={total_invoiced}"
            + (" (dry-run)" if dry else "")
        ))
