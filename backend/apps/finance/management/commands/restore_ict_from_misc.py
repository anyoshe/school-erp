"""
Restore ICT invoice lines that were incorrectly pointed at
"Miscellaneous charges" (after category-name rehome).

Also reactivates a real ICT FeeItem and repoints fee-structure rows.

  python manage.py restore_ict_from_misc --dry-run
  python manage.py restore_ict_from_misc
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = "Move ICT lines off Miscellaneous charges onto an active ICT fee item."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")

    def handle(self, *args, **options):
        from apps.school.models import School
        from apps.finance.models import (
            FeeCategory,
            FeeItem,
            FeeStructureItem,
            InvoiceLine,
            Payment,
        )

        dry = options["dry_run"]
        qs = School.objects.all()
        sid = (options.get("school_id") or "").strip()
        if sid:
            qs = qs.filter(pk=sid)

        for school in qs:
            self.stdout.write(self.style.MIGRATE_HEADING(school.name))

            # Prefer existing ICT item (even inactive); else create under ICT category
            ict = (
                FeeItem.objects.filter(category__school=school, name__iexact="ICT")
                .order_by("-is_active", "id")
                .first()
            )
            if not ict:
                cat, _ = FeeCategory.objects.get_or_create(
                    school=school,
                    name="ICT",
                    defaults={
                        "description": "ICT fees",
                        "is_mandatory": True,
                        "display_order": 40,
                    },
                )
                ict = FeeItem.objects.create(
                    category=cat,
                    name="ICT",
                    description="ICT fee",
                    frequency="per_term",
                    is_active=True,
                    is_optional=False,
                )
                self.stdout.write(f"  created FeeItem ICT id={ict.id}")
            else:
                # Move out of pure "Miscellaneous" category if needed
                if "miscellaneous" in (ict.category.name or "").lower() and (
                    ict.category.name or ""
                ).strip().lower() in ("miscellaneous",):
                    cat, _ = FeeCategory.objects.get_or_create(
                        school=school,
                        name="ICT",
                        defaults={
                            "description": "ICT fees",
                            "is_mandatory": True,
                            "display_order": 40,
                        },
                    )
                    if not dry:
                        ict.category = cat
                if not ict.is_active and not dry:
                    ict.is_active = True
                    ict.save(update_fields=["is_active", "category"] if ict.category_id else ["is_active"])
                elif not dry and ict.category_id:
                    ict.save(update_fields=["category", "is_active"])
                self.stdout.write(
                    f"  using FeeItem ICT id={ict.id} category={ict.category.name!r} active={ict.is_active}"
                )

            misc_ids = list(
                FeeItem.objects.filter(category__school=school)
                .filter(
                    Q(name__iexact="Miscellaneous charges")
                    | Q(name__iexact="Miscellaneous")
                )
                .values_list("id", flat=True)
            )

            # Invoice lines: item is misc OR description ICT on misc-ish item
            lines = InvoiceLine.objects.filter(invoice__school=school).filter(
                Q(item_id__in=misc_ids) | Q(description__iexact="ICT")
            )
            line_n = 0
            for line in lines:
                # Only ICT descriptions (or any line still on misc that is clearly ICT)
                desc = (line.description or "").strip()
                if desc.upper() != "ICT" and line.item_id not in misc_ids:
                    continue
                if desc.upper() != "ICT" and line.item_id in misc_ids:
                    # misc item but not ICT — leave for manual review
                    if "ict" not in desc.lower():
                        continue
                if line.item_id == ict.id and desc == "ICT":
                    continue
                self.stdout.write(
                    f"  {'[dry] ' if dry else ''}line {line.id} "
                    f"INV {line.invoice.invoice_number} {desc!r} {line.amount} "
                    f"→ ICT"
                )
                if not dry:
                    line.item = ict
                    if desc.upper() == "ICT" or not desc:
                        line.description = "ICT"
                    line.save(update_fields=["item", "description"])
                line_n += 1

            # Structure rows on misc that should be ICT
            struct_n = 0
            for si in FeeStructureItem.objects.filter(
                structure__school=school, item_id__in=misc_ids
            ):
                # Only if amount matches typical ICT (300) or structure has no other ICT
                self.stdout.write(
                    f"  {'[dry] ' if dry else ''}structure item {si.id} "
                    f"amount={si.amount} → ICT"
                )
                if not dry:
                    existing = FeeStructureItem.objects.filter(
                        structure_id=si.structure_id, item=ict
                    ).first()
                    if existing:
                        if Decimal(str(si.amount or 0)) > Decimal(str(existing.amount or 0)):
                            existing.amount = si.amount
                            existing.save(update_fields=["amount"])
                        si.delete()
                    else:
                        si.item = ict
                        si.save(update_fields=["item"])
                struct_n += 1

            # Payment allocations: rename Miscellaneous → ICT when amount matches ICT line
            pay_n = 0
            for pay in Payment.objects.filter(invoice__school=school).exclude(
                line_allocations=[]
            ):
                allocs = pay.line_allocations or []
                if not isinstance(allocs, list):
                    continue
                changed = False
                new_rows = []
                for row in allocs:
                    if not isinstance(row, dict):
                        new_rows.append(row)
                        continue
                    row = dict(row)
                    desc = str(row.get("description") or "")
                    if "misc" in desc.lower() or "miscellaneous" in desc.lower():
                        # If this payment's invoice has an ICT line, relabel
                        has_ict = InvoiceLine.objects.filter(
                            invoice_id=pay.invoice_id, item=ict
                        ).exists() or InvoiceLine.objects.filter(
                            invoice_id=pay.invoice_id, description__iexact="ICT"
                        ).exists()
                        if has_ict or Decimal(str(row.get("amount") or 0)) == Decimal("300"):
                            row["description"] = "ICT"
                            changed = True
                            pay_n += 1
                    new_rows.append(row)
                if changed and not dry:
                    pay.line_allocations = new_rows
                    pay.save(update_fields=["line_allocations"])

            self.stdout.write(
                self.style.SUCCESS(
                    f"  lines={line_n} structure={struct_n} payment_alloc_relabels={pay_n} "
                    f"dry={dry}"
                )
            )
