from django.core.management.base import BaseCommand
from apps.school.models import School
from apps.academics.timetable_views import seed_periods_for_school


class Command(BaseCommand):
    help = "Seed default timetable periods for one or all schools."

    def add_arguments(self, parser):
        parser.add_argument("--school-id", default="")
        parser.add_argument("--force", action="store_true", help="Add missing defaults even if periods exist")

    def handle(self, *args, **options):
        force = options["force"]
        sid = (options.get("school_id") or "").strip()
        qs = School.objects.all()
        if sid:
            qs = qs.filter(pk=sid)
        for school in qs.iterator():
            result = seed_periods_for_school(school, force=force)
            self.stdout.write(
                f"{school.name}: created={result['created']} total={result['total']} ({result['detail']})"
            )
