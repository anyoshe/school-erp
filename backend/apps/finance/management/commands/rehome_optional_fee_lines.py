"""
Safe repair/merge for optional fee items.

  python manage.py rehome_optional_fee_lines --dry-run
  python manage.py rehome_optional_fee_lines
  python manage.py rehome_optional_fee_lines --repair-only
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Repair misc misclassification and merge true optional fee aliases."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")
        parser.add_argument(
            "--repair-only",
            action="store_true",
            help="Only undo misc misclassification + assessment merge",
        )

    def handle(self, *args, **options):
        from apps.school.models import School
        from apps.finance.fee_catalog import (
            consolidate_assessment_and_payment_labels,
            ensure_optional_fee_catalog,
            match_catalog_entry,
            _find_alias_items,
            CANONICAL_OPTIONALS,
            rehome_stray_optional_invoice_lines,
            repair_misc_misclassified_lines,
        )
        from apps.finance.models import FeeItem, InvoiceLine

        qs = School.objects.all()
        sid = (options.get("school_id") or "").strip()
        if sid:
            qs = qs.filter(pk=sid)
        dry = options["dry_run"]
        repair_only = options["repair_only"]

        for school in qs:
            catalog = ensure_optional_fee_catalog(school)
            by_code = {c["code"]: c for c in catalog}
            misc_id = by_code.get("misc", {}).get("fee_item_id")

            if dry:
                self.stdout.write(f"[dry] {school.name}")
                misc_n = 0
                if misc_id:
                    for line in InvoiceLine.objects.filter(
                        invoice__school=school, item_id=misc_id
                    ).select_related("item")[:2000]:
                        entry = match_catalog_entry(line.description or "", allow_misc=False)
                        if entry:
                            misc_n += 1
                            self.stdout.write(
                                f"  misc line would restore → {entry['code']}: "
                                f"{(line.description or '')[:60]!r}"
                            )
                self.stdout.write(f"  misc lines to restore: {misc_n}")
                for entry in CANONICAL_OPTIONALS:
                    if not entry.get("auto_rehome", True):
                        continue
                    target_id = by_code[entry["code"]]["fee_item_id"]
                    aliases = _find_alias_items(school, entry, target_id)
                    if aliases:
                        names = ", ".join(repr(a.name) for a in aliases)
                        self.stdout.write(
                            f"  would merge → {entry['item']!r}: {names}"
                        )
                continue

            if repair_only:
                result = repair_misc_misclassified_lines(school)
            else:
                result = rehome_stray_optional_invoice_lines(school)
            # Always unify assessment labels on payments/invoice lines
            cons = consolidate_assessment_and_payment_labels(school)
            result = {**(result if isinstance(result, dict) else {'result': result}), 'consolidate': cons}
            self.stdout.write(self.style.SUCCESS(f"{school.name}: {result}"))
