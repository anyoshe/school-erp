"""
End-to-end audit: Admissions money → Finance for enrolled students.

For each enrolled student prints:
  admission fee rows | invoice due | payments | gap

Then syncs so Payment totals match school fees actually received:
  target = max(sum(AdmissionFeePayment), sum(Payments))
  If invoices are fully billed and school confirms fees were received at enroll
  but Payment rows are short, posts the shortfall once (school fees only).

Finally rebuilds invoice.amount_paid/balance from Payment rows.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum


class Command(BaseCommand):
    help = "Audit admission→finance fee flow and sync Payment rows to match received school fees"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")
        parser.add_argument(
            "--assume-fully-paid",
            action="store_true",
            help="If invoices exist, treat billed amount as collected when payments lag (use when all fees were received)",
        )

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment, Application
        from apps.finance.models import Invoice, Payment
        from apps.students.models import Student

        dry = options["dry_run"]
        school_id = (options.get("school_id") or "").strip()
        assume_full = options["assume_fully_paid"]

        # Clean failed experimental backfill rows (not enrollment deposits)
        junk = Payment.objects.filter(notes__icontains="backfill")
        if school_id:
            junk = junk.filter(school_id=school_id)
        jc = junk.count()
        if jc and not dry:
            junk.delete()
        self.stdout.write(f"Removed backfill junk payments: {jc}")

        students = Student.objects.select_related("school").all()
        if school_id:
            students = students.filter(school_id=school_id)

        self.stdout.write("")
        self.stdout.write(
            f"{'ADM':<16} {'NAME':<22} {'ADM_ROWS':>10} {'INVOICED':>10} {'PAYMENTS':>10} {'TARGET':>10} {'GAP':>10}"
        )
        self.stdout.write("-" * 96)

        posted = 0
        for student in students.order_by("admission_number").iterator():
            app = Application.objects.filter(student=student).first()
            adm = Decimal("0")
            if app:
                adm = (
                    AdmissionFeePayment.objects.filter(application=app).aggregate(t=Sum("amount"))["t"]
                    or Decimal("0")
                )

            invoices = list(
                Invoice.objects.filter(student=student).order_by("due_date", "generated_at", "id")
            )
            due = sum(
                (
                    Decimal(str(i.amount_due or 0)) + Decimal(str(i.late_fee_applied or 0))
                    for i in invoices
                ),
                Decimal("0"),
            )
            paid = (
                Payment.objects.filter(invoice__student=student)
                .exclude(payment_method="TRANSFER")
                .aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )

            # Target cash that should be on the ledger as school fees:
            # - Always at least AdmissionFeePayment (enrollment collections recorded there)
            # - At least existing Payments
            # - With --assume-fully-paid: full invoice due (all term fees received)
            target = max(adm, paid)
            if assume_full and due > 0:
                target = max(target, due)
            elif due > 0 and paid < due:
                # If every invoice balance is 0 / is_paid, treat as fully collected
                settled = bool(invoices) and all(
                    bool(getattr(i, "is_paid", False))
                    or Decimal(str(getattr(i, "balance", 0) or 0)) <= 0
                    for i in invoices
                )
                if settled:
                    target = max(target, due)

            if due > 0:
                target = min(target, due)

            gap = target - paid
            name = f"{student.first_name} {student.last_name}"[:22]
            self.stdout.write(
                f"{(student.admission_number or '')[:16]:<16} {name:<22} "
                f"{adm:>10} {due:>10} {paid:>10} {target:>10} {gap:>10}"
            )

            if gap <= 0 or not invoices:
                if gap > 0 and not invoices:
                    self.stdout.write(
                        self.style.WARNING(f"  → no invoices; assign fee structure first")
                    )
                continue

            remaining = gap
            for inv in invoices:
                if remaining <= 0:
                    break
                inv_due = Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
                inv_paid = (
                    Payment.objects.filter(invoice=inv)
                    .exclude(payment_method="TRANSFER")
                    .aggregate(t=Sum("amount"))["t"]
                    or Decimal("0")
                )
                room = inv_due - inv_paid
                if room <= 0:
                    if inv is invoices[-1] and remaining > 0:
                        pay_amt = remaining
                    else:
                        continue
                else:
                    pay_amt = min(remaining, room)

                if not dry:
                    Payment.objects.create(
                        school=student.school,
                        invoice=inv,
                        amount=pay_amt,
                        payment_method="CASH",
                        notes=(
                            "School fees received at enrollment (audit sync) "
                            f"student={student.admission_number}"
                        ),
                    )
                posted += 1
                remaining -= pay_amt
                self.stdout.write(
                    f"  {'[dry] ' if dry else ''}POST {pay_amt} → {inv.invoice_number}"
                )

        # Rebuild invoice totals from payments
        inv_qs = Invoice.objects.all()
        if school_id:
            inv_qs = inv_qs.filter(school_id=school_id)
        for inv in inv_qs.iterator():
            p = (
                Payment.objects.filter(invoice=inv)
                .exclude(payment_method="TRANSFER")
                .aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            d = Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
            if not dry:
                Invoice.objects.filter(pk=inv.pk).update(
                    amount_paid=p,
                    balance=max(Decimal("0"), d - p),
                    is_paid=(d > 0 and p >= d),
                )

        pay_qs = Payment.objects.exclude(payment_method="TRANSFER")
        if school_id:
            pay_qs = pay_qs.filter(school_id=school_id)
        total_pay = pay_qs.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        total_due = inv_qs.aggregate(t=Sum("amount_due"))["t"] or Decimal("0")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"SYNC complete posted_rows={posted} "
            f"TOTAL_SCHOOL_FEE_PAYMENTS={total_pay} TOTAL_INVOICED={total_due}"
            + (" (dry-run)" if dry else "")
        ))
        if total_due and total_pay != total_due:
            self.stdout.write(
                self.style.WARNING(
                    "Payments still != invoiced. Re-run with --assume-fully-paid "
                    "if every student fully paid school fees."
                )
            )
