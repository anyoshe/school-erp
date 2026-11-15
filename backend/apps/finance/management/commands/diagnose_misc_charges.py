"""
List every invoice line and payment allocation that contributes to
"Miscellaneous charges" on the finance dashboard.

  python manage.py diagnose_misc_charges
  python manage.py diagnose_misc_charges --school-id UUID
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q, Sum


class Command(BaseCommand):
    help = "Diagnose which invoices/payments feed Miscellaneous charges totals."

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=str, default="")
        parser.add_argument(
            "--move-to",
            type=str,
            default="",
            help="Optional: re-point misc invoice lines to this FeeItem name (e.g. ICT)",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        from apps.school.models import School
        from apps.finance.models import FeeItem, InvoiceLine, Payment, FeeStructureItem

        qs = School.objects.all()
        sid = (options.get("school_id") or "").strip()
        if sid:
            qs = qs.filter(pk=sid)

        move_to_name = (options.get("move_to") or "").strip()
        dry = options["dry_run"]

        for school in qs:
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n=== {school.name} ==="))

            misc_items = list(
                FeeItem.objects.filter(category__school=school).filter(
                    Q(name__icontains="miscellaneous")
                    | Q(name__iexact="misc")
                    | Q(category__name__icontains="miscellaneous")
                ).select_related("category")
            )
            # Prefer canonical name
            if not misc_items:
                self.stdout.write("No Miscellaneous fee items found.")
                continue

            for mi in misc_items:
                self.stdout.write(
                    f"FeeItem id={mi.id} name={mi.name!r} "
                    f"category={mi.category.name!r} active={mi.is_active}"
                )

            misc_ids = [m.id for m in misc_items]

            # --- Invoice lines ---
            lines = (
                InvoiceLine.objects.filter(invoice__school=school)
                .filter(Q(item_id__in=misc_ids) | Q(description__icontains="miscellaneous"))
                .select_related("invoice", "invoice__student", "item")
                .order_by("invoice__invoice_number", "id")
            )
            billed = Decimal("0")
            self.stdout.write(self.style.HTTP_INFO("\nInvoice lines (billed / pending share source):"))
            if not lines.exists():
                self.stdout.write("  (none)")
            for line in lines:
                inv = line.invoice
                student = getattr(inv, "student", None)
                adm = getattr(student, "admission_number", "") or ""
                name = ""
                if student:
                    name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
                due = Decimal(str(inv.amount_due or 0)) + Decimal(
                    str(getattr(inv, "late_fee_applied", 0) or 0)
                )
                paid = Decimal(str(inv.amount_paid or 0))
                bal = max(Decimal("0"), due - paid)
                ratio = (bal / due) if due > 0 else Decimal("0")
                line_amt = Decimal(str(line.amount or 0))
                line_pending = (line_amt * ratio).quantize(Decimal("0.01"))
                billed += line_amt
                item_name = getattr(line.item, "name", None) or "(no item)"
                self.stdout.write(
                    f"  INV {inv.invoice_number} | {adm} {name} | "
                    f"line_id={line.id} item={item_name!r} desc={line.description!r} | "
                    f"line={line_amt} inv_due={due} inv_paid={paid} "
                    f"line_pending≈{line_pending} term={getattr(inv, 'term', '')}"
                )

            self.stdout.write(f"  SUM line amounts (billed on misc-ish lines): {billed}")

            # --- Payment allocations ---
            self.stdout.write(
                self.style.HTTP_INFO("\nPayment allocations labelled miscellaneous:")
            )
            collected = Decimal("0")
            pay_n = 0
            for pay in Payment.objects.filter(invoice__school=school).select_related(
                "invoice", "invoice__student"
            ):
                allocs = pay.line_allocations or []
                if not isinstance(allocs, list):
                    continue
                hits = []
                for a in allocs:
                    if not isinstance(a, dict):
                        continue
                    desc = str(a.get("description") or a.get("category") or "")
                    if "misc" in desc.lower() or "miscellaneous" in desc.lower():
                        hits.append(a)
                if not hits:
                    continue
                pay_n += 1
                inv = pay.invoice
                student = getattr(inv, "student", None)
                adm = getattr(student, "admission_number", "") or ""
                name = ""
                if student:
                    name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
                for a in hits:
                    a_amt = Decimal(str(a.get("amount") or 0))
                    collected += a_amt
                    self.stdout.write(
                        f"  PAY receipt={pay.receipt_number or pay.id} "
                        f"date={pay.payment_date or pay.paid_at} "
                        f"INV {inv.invoice_number} | {adm} {name} | "
                        f"alloc={a.get('description')!r} amount={a_amt} "
                        f"line_id={a.get('line_id')}"
                    )
            self.stdout.write(
                f"  SUM payment allocs → collected≈{collected} ({pay_n} payments)"
            )

            # --- Pro-rata payments without allocs but invoice has misc lines ---
            self.stdout.write(
                self.style.HTTP_INFO(
                    "\nPayments without line_allocations on invoices that have misc lines "
                    "(dashboard splits payment across all lines by ratio):"
                )
            )
            inv_ids_with_misc = set(
                InvoiceLine.objects.filter(
                    invoice__school=school, item_id__in=misc_ids
                ).values_list("invoice_id", flat=True)
            )
            implied = Decimal("0")
            for pay in Payment.objects.filter(
                invoice_id__in=inv_ids_with_misc
            ).select_related("invoice"):
                allocs = pay.line_allocations or []
                if allocs:
                    continue
                inv = pay.invoice
                lines = list(InvoiceLine.objects.filter(invoice=inv).select_related("item"))
                total = sum((Decimal(str(ln.amount or 0)) for ln in lines), Decimal("0"))
                if total <= 0:
                    continue
                pay_amt = Decimal(str(pay.amount or 0))
                for ln in lines:
                    if ln.item_id not in misc_ids:
                        continue
                    share = (pay_amt * Decimal(str(ln.amount or 0)) / total).quantize(
                        Decimal("0.01")
                    )
                    implied += share
                    self.stdout.write(
                        f"  PAY {pay.receipt_number or pay.id} INV {inv.invoice_number} "
                        f"payment={pay_amt} misc_line={ln.amount} share≈{share} "
                        f"desc={ln.description!r}"
                    )
            self.stdout.write(f"  SUM implied misc from unallocated payments: {implied}")

            # Structure
            struct_n = FeeStructureItem.objects.filter(
                structure__school=school, item_id__in=misc_ids
            ).count()
            self.stdout.write(f"\nFee structure rows pointing at misc items: {struct_n}")

            self.stdout.write(
                self.style.WARNING(
                    "\nDashboard notes:\n"
                    "  Collected ≈ sum of payment line_allocations labelled misc\n"
                    "            + pro-rata share of payments without allocations\n"
                    "  Pending  ≈ each misc invoice line × (invoice balance / invoice due)\n"
                    "So misc can show 'pending' even if you never intended a misc fee —\n"
                    "it is a share of unpaid balance on any invoice that still has a misc line."
                )
            )

            # Optional move
            if move_to_name:
                dest = FeeItem.objects.filter(
                    category__school=school, name__iexact=move_to_name
                ).first()
                if not dest:
                    dest = FeeItem.objects.filter(
                        category__school=school, name__icontains=move_to_name
                    ).first()
                if not dest:
                    self.stdout.write(self.style.ERROR(f"No fee item matching {move_to_name!r}"))
                    continue
                n = 0
                for line in InvoiceLine.objects.filter(
                    invoice__school=school, item_id__in=misc_ids
                ):
                    self.stdout.write(
                        f"  {'[dry] ' if dry else ''}move line {line.id} "
                        f"({line.description!r} {line.amount}) → {dest.name}"
                    )
                    if not dry:
                        line.item = dest
                        line.save(update_fields=["item"])
                    n += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{'Would move' if dry else 'Moved'} {n} lines → {dest.name}"
                    )
                )
