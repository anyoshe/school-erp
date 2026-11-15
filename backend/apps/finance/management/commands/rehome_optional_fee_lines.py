"""
Re-point invoice lines for assessment books, uniforms, meals, etc. onto
canonical optional fee items.

  python manage.py rehome_optional_fee_lines --dry-run
  python manage.py rehome_optional_fee_lines
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Map stray clearance fee lines onto canonical optional fee items."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default="")

    def handle(self, *args, **options):
        from apps.school.models import School
        from apps.finance.fee_catalog import rehome_stray_optional_invoice_lines, ensure_optional_fee_catalog
        from apps.finance.models import InvoiceLine

        qs = School.objects.all()
        sid = (options.get("school_id") or "").strip()
        if sid:
            qs = qs.filter(pk=sid)
        dry = options["dry_run"]
        for school in qs:
            ensure_optional_fee_catalog(school)
            if dry:
                # count potential matches without saving
                from apps.finance.fee_catalog import match_catalog_entry
                n = 0
                for line in InvoiceLine.objects.filter(invoice__school=school).select_related("item")[:5000]:
                    text = f"{line.description or ''} {getattr(line.item, 'name', '') or ''}"
                    if match_catalog_entry(text):
                        n += 1
                self.stdout.write(f"[dry] {school.name}: ~{n} lines match catalog keywords")
                continue
            result = rehome_stray_optional_invoice_lines(school)
            self.stdout.write(self.style.SUCCESS(f"{school.name}: {result}"))
