"""
Seed free CBC primary/secondary digital starter links for one or all schools.

Usage:
  python manage.py seed_library_starter
  python manage.py seed_library_starter --school-id <uuid>
  python manage.py seed_library_starter --levels primary secondary
"""
from django.core.management.base import BaseCommand, CommandError

from apps.school.models import School
from apps.library.seed_starter import seed_library_starter_pack, seed_all_schools


class Command(BaseCommand):
    help = "Seed free starter digital library links (KEC, storybooks, Khan, etc.) per school."

    def add_arguments(self, parser):
        parser.add_argument(
            "--school-id",
            type=str,
            default="",
            help="Only seed this school UUID. Default: all schools.",
        )
        parser.add_argument(
            "--levels",
            nargs="*",
            default=[],
            help="Optional filter: primary secondary (both always included in catalog rows tagged both).",
        )

    def handle(self, *args, **options):
        levels = options.get("levels") or None
        if levels is not None and len(levels) == 0:
            levels = None
        school_id = (options.get("school_id") or "").strip()

        if school_id:
            school = School.objects.filter(pk=school_id).first()
            if not school:
                raise CommandError(f"School not found: {school_id}")
            result = seed_library_starter_pack(school, levels=levels)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{school.name}: created={result['created']} skipped={result['skipped']} "
                    f"catalog={result['catalog_size']}"
                )
            )
            return

        results = seed_all_schools(levels=levels)
        total_created = sum(r["created"] for r in results)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(results)} school(s); total new resources={total_created}"
            )
        )
        for r in results:
            if r["created"]:
                self.stdout.write(
                    f"  {r['school_name']}: +{r['created']} (skipped {r['skipped']})"
                )
