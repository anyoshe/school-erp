from django.core.management.base import BaseCommand

from apps.school.models import School
from apps.school.module_seed import (
    SHELL_MODULE_CODES,
    ensure_school_core_modules,
    prune_school_shell_modules,
)


class Command(BaseCommand):
    help = (
        "Remove placeholder modules (library, transport, …) from schools and "
        "ensure core modules remain attached."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be removed without saving",
        )
        parser.add_argument(
            "--keep-reports",
            action="store_true",
            help="Do not prune the reports module",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        codes = list(SHELL_MODULE_CODES)
        if options["keep_reports"] and "reports" in codes:
            codes.remove("reports")

        total = 0
        # Avoid server-side cursors (Neon pooler closes them mid-iteration)
        for school in list(School.objects.all()[:500]):
            before = set(school.modules.values_list("code", flat=True))
            if dry:
                would = before.intersection(codes)
                if would:
                    self.stdout.write(f"[dry] {school.name}: remove {sorted(would)}")
                    total += len(would)
                continue
            ensure_school_core_modules(school)
            removed = prune_school_shell_modules(school, codes=codes)
            if removed:
                self.stdout.write(f"{school.name}: removed {removed}")
                total += len(removed)
        self.stdout.write(self.style.SUCCESS(f"Done. removals={total} dry={dry}"))
