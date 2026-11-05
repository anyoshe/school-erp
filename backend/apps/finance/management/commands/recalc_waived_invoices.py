"""
Backfill / recalculate invoices that already have waived lines.

Ensures:
- waived lines have amount=0 and original_amount preserved
- invoice amount_due / balance exclude waived amounts
- amount_paid (collections) is not increased by waivers

Usage:
  python manage.py recalc_waived_invoices --dry-run
  python manage.py recalc_waived_invoices
  python manage.py recalc_waived_invoices --admission PSS-2026-0024
  python manage.py recalc_waived_invoices --school-id <uuid>
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.finance.clearance import recalculate_invoice_totals
from apps.finance.models import Invoice, InvoiceLine


class Command(BaseCommand):
    help = "Recalculate invoices with waived lines so balance excludes waivers (no fake collections)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview only")
        parser.add_argument(
            "--admission",
            type=str,
            default="",
            help="Limit to one student admission number",
        )
        parser.add_argument(
            "--school-id",
            type=str,
            default="",
            help="Limit to one school UUID",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        admission = (options.get("admission") or "").strip()
        school_id = (options.get("school_id") or "").strip()

        qs = InvoiceLine.objects.filter(is_waived=True).select_related(
            "invoice", "invoice__student", "invoice__school"
        )
        if admission:
            qs = qs.filter(invoice__student__admission_number__iexact=admission)
        if school_id:
            qs = qs.filter(
                Q(invoice__school_id=school_id)
                | Q(invoice__student__school_id=school_id)
            )

        invoice_ids = list(qs.values_list("invoice_id", flat=True).distinct())
        if not invoice_ids:
            self.stdout.write(self.style.WARNING("No waived invoice lines found."))
            return

        fixed_lines = 0
        fixed_invoices = 0

        for inv in Invoice.objects.filter(id__in=invoice_ids).select_related("student"):
            lines = list(InvoiceLine.objects.filter(invoice=inv))
            for ln in lines:
                if not ln.is_waived:
                    continue
                base = ln.original_amount
                if base is None:
                    # Preserve what was billed before waive if amount already 0
                    base = ln.amount if Decimal(str(ln.amount or 0)) > 0 else Decimal("0")
                changes = []
                if ln.original_amount is None and Decimal(str(base or 0)) > 0:
                    ln.original_amount = Decimal(str(base))
                    changes.append("original_amount")
                if Decimal(str(ln.amount or 0)) != Decimal("0"):
                    ln.amount = Decimal("0")
                    changes.append("amount→0")
                if changes and not dry:
                    ln.save(update_fields=list({*changes, "amount", "original_amount"} & set(
                        ["amount", "original_amount"]
                    )) or ["amount", "original_amount"])
                    fixed_lines += 1
                elif changes:
                    fixed_lines += 1
                    self.stdout.write(
                        f"  [dry] line {ln.id} {ln.description}: {', '.join(changes)}"
                    )

            before_due = inv.amount_due
            before_bal = inv.balance
            if not dry:
                recalculate_invoice_totals(inv)
                inv.refresh_from_db()
            else:
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
            fixed_invoices += 1
            if not dry:
                self.stdout.write(
                    f"  {getattr(inv.student, 'admission_number', '?')} "
                    f"{inv.invoice_number}: due {before_due}→{inv.amount_due} "
                    f"bal {before_bal}→{inv.balance} paid(cash)={inv.amount_paid}"
                )

        prefix = "[dry-run] " if dry else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Done. invoices={fixed_invoices} waived_lines_touched={fixed_lines}"
            )
        )
