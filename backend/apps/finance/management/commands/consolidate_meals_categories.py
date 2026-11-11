from django.core.management.base import BaseCommand

from apps.school.models import School
from apps.finance.lunch import ensure_meals_fee_defaults, consolidate_meals_categories


class Command(BaseCommand):
    help = (
        "Merge duplicate Meals/Catering fee categories into one "
        "'Meals & catering' with Lunch item; remove empty shells."
    )

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=str, default=None)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        qs = School.objects.all()
        if options.get("school_id"):
            qs = qs.filter(pk=options["school_id"])
        dry = options.get("dry_run")
        for school in qs:
            if dry:
                from apps.finance.lunch import _meals_like_categories
                cats = _meals_like_categories(school)
                self.stdout.write(
                    f"[dry] {school.name}: {len(cats)} meals-like categories → "
                    + ", ".join(f"{c.name}(items={c.items.count()})" for c in cats)
                )
                continue
            result = ensure_meals_fee_defaults(school)
            cat = result["category"]
            self.stdout.write(
                self.style.SUCCESS(
                    f"{school.name}: kept '{cat.name}' id={cat.id} "
                    f"items={cat.items.count()} "
                    f"removed_empty={result.get('removed_empty')} "
                    f"merged={result.get('consolidated', {}).get('merged')}"
                )
            )
