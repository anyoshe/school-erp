"""
Merge alias optional fee items (e.g. Assessment Book vs Assessment books)
onto the canonical catalog and re-point invoice lines.

  python manage.py rehome_optional_fee_lines --dry-run
  python manage.py rehome_optional_fee_lines
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Merge alias optional fee items and rehome invoice lines onto catalog."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")

    def handle(self, *args, **options):
        from apps.school.models import School
        from apps.finance.fee_catalog import (
            ensure_optional_fee_catalog,
            match_catalog_entry,
            _find_alias_items,
            CANONICAL_OPTIONALS,
            rehome_stray_optional_invoice_lines,
        )
        from apps.finance.models import FeeItem, InvoiceLine

        qs = School.objects.all()
        sid = (options.get("school_id") or "").strip()
        if sid:
            qs = qs.filter(pk=sid)
        dry = options["dry_run"]

        for school in qs:
            catalog = ensure_optional_fee_catalog(school)
            by_code = {c["code"]: c for c in catalog}

            if dry:
                self.stdout.write(f"[dry] {school.name}")
                for entry in CANONICAL_OPTIONALS:
                    target_id = by_code[entry["code"]]["fee_item_id"]
                    aliases = _find_alias_items(school, entry, target_id)
                    if aliases:
                        names = ", ".join(repr(a.name) for a in aliases)
                        self.stdout.write(
                            f"  would merge → {entry['item']!r}: {names}"
                        )
                n = 0
                for line in InvoiceLine.objects.filter(
                    invoice__school=school
                ).select_related("item")[:5000]:
                    text = f"{line.description or ''} {getattr(line.item, 'name', '') or ''}"
                    if match_catalog_entry(text):
                        n += 1
                self.stdout.write(f"  ~{n} invoice lines match catalog keywords")
                continue

            result = rehome_stray_optional_invoice_lines(school)
            self.stdout.write(self.style.SUCCESS(f"{school.name}: {result}"))
