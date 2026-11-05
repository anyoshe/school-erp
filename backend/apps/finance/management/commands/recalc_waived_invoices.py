"""
Backfill / recalculate invoices that have waived (or zeroed) lines.

Usage:
  python manage.py migrate finance
  python manage.py recalc_waived_invoices --dry-run
  python manage.py recalc_waived_invoices --mark-zero-as-waived --dry-run
  python manage.py recalc_waived_invoices --mark-zero-as-waived
  python manage.py recalc_waived_invoices --admission PSS-2026-0024 --mark-zero-as-waived
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.finance.clearance import recalculate_invoice_totals
from apps.finance.models import Invoice, InvoiceLine


class Command(BaseCommand):
    help = "Recalculate invoices so waived amounts leave balance but not collections."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--admission", type=str, default="")
        parser.add_argument("--school-id", type=str, default="")
        parser.add_argument(
            "--mark-zero-as-waived",
            action="store_true",
            help="Treat lines with amount=0 and original_amount>0 as waived (UI may have zeroed without flag).",
        )
        parser.add_argument(
            "--diagnose",
            action="store_true",
            help="Print counts of lines / zero lines / waived lines",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        admission = (options.get("admission") or "").strip()
        school_id = (options.get("school_id") or "").strip()
        mark_zero = options["mark_zero_as_waived"]
        diagnose = options["diagnose"]

        base = InvoiceLine.objects.select_related(
            "invoice", "invoice__student", "invoice__school"
        )
        if admission:
            base = base.filter(invoice__student__admission_number__iexact=admission)
        if school_id:
            base = base.filter(
                Q(invoice__school_id=school_id)
                | Q(invoice__student__school_id=school_id)
            )

        if diagnose or True:
            total = base.count()
            waived = base.filter(is_waived=True).count()
            zero_amt = base.filter(amount=0).count()
            zero_with_orig = base.filter(amount=0, original_amount__gt=0).count()
            self.stdout.write(
                f"Lines total={total} is_waived={waived} amount=0={zero_amt} "
                f"amount=0&original>0={zero_with_orig}"
            )
            if diagnose and not mark_zero and waived == 0:
                self.stdout.write(
                    self.style.WARNING(
                        "No is_waived=True rows. If you waived in the UI, either migration "
                        "0009 was not applied, or only amount was cleared. "
                        "Re-run with --mark-zero-as-waived after migrate finance."
                    )
                )

        # Optionally mark zeroed lines as waived
        if mark_zero:
            candidates = base.filter(amount=0).filter(
                Q(original_amount__gt=0) | Q(original_amount__isnull=True)
            )
            n = 0
            for ln in candidates:
                if ln.is_waived and Decimal(str(ln.amount or 0)) == 0:
                    continue
                orig = ln.original_amount
                if orig is None or Decimal(str(orig or 0)) <= 0:
                    # keep description context; cannot invent original if never stored
                    orig = None
                if dry:
                    self.stdout.write(
                        f"  [dry] mark waived line={ln.id} "
                        f"{getattr(ln.invoice.student, 'admission_number', '?')} "
                        f"'{ln.description}' orig={orig}"
                    )
                else:
                    ln.is_waived = True
                    ln.amount = Decimal("0")
                    if ln.original_amount is None and orig is not None:
                        ln.original_amount = orig
                    if not ln.adjustment_reason:
                        ln.adjustment_reason = "Backfilled waive"
                    ln.save()
                n += 1
            self.stdout.write(f"Mark-zero-as-waived candidates={n}")

        qs = base.filter(is_waived=True)
        if not qs.exists() and mark_zero and dry:
            self.stdout.write(
                self.style.WARNING("Dry-run: would mark zeros then recalc. Run without --dry-run.")
            )
            return
        if not qs.exists():
            self.stdout.write(
                self.style.WARNING(
                    "No waived invoice lines found.\n"
                    "1) python manage.py migrate finance\n"
                    "2) Waive again in clearance UI, or:\n"
                    "   python manage.py recalc_waived_invoices --mark-zero-as-waived\n"
                    "3) python manage.py recalc_waived_invoices --diagnose"
                )
            )
            return

        invoice_ids = list(qs.values_list("invoice_id", flat=True).distinct())
        fixed_invoices = 0
        for inv in Invoice.objects.filter(id__in=invoice_ids).select_related("student"):
            before_due = inv.amount_due
            before_bal = inv.balance
            if dry:
                lines = list(InvoiceLine.objects.filter(invoice=inv))
                collectible = sum(
                    (Decimal(str(ln.amount or 0)) for ln in lines if not ln.is_waived),
                    Decimal("0"),
                )
                paid = Decimal(str(inv.amount_paid or 0))
                self.stdout.write(
                    f"  [dry] {getattr(inv.student, 'admission_number', '?')} "
                    f"{inv.invoice_number}: due {before_due}→{collectible} "
                    f"bal {before_bal}→{max(Decimal('0'), collectible - paid)} "
                    f"paid(cash)={paid}"
                )
            else:
                # Ensure waived lines amount=0
                InvoiceLine.objects.filter(invoice=inv, is_waived=True).exclude(
                    amount=0
                ).update(amount=Decimal("0"))
                recalculate_invoice_totals(inv)
                inv.refresh_from_db()
                self.stdout.write(
                    f"  {getattr(inv.student, 'admission_number', '?')} "
                    f"{inv.invoice_number}: due {before_due}→{inv.amount_due} "
                    f"bal {before_bal}→{inv.balance} paid(cash)={inv.amount_paid}"
                )
            fixed_invoices += 1

        prefix = "[dry-run] " if dry else ""
        self.stdout.write(
            self.style.SUCCESS(f"{prefix}Done. invoices={fixed_invoices}")
        )
