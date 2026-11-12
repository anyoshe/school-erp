"""
Cron-friendly library notification processor (idempotent).

Example (daily):
  python manage.py process_library_notifications
  python manage.py process_library_notifications --school-id <uuid>
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Send due-soon / overdue / reservation / assignment library notifications (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=str, default="")
        parser.add_argument("--due-soon-days", type=int, default=2)

    def handle(self, *args, **options):
        from apps.library.notifications import process_due_and_overdue
        from apps.school.models import School

        school = None
        sid = (options.get("school_id") or "").strip()
        if sid:
            school = School.objects.filter(pk=sid).first()
            if not school:
                self.stderr.write("School not found")
                return
        stats = process_due_and_overdue(school=school, due_soon_days=options["due_soon_days"])
        self.stdout.write(self.style.SUCCESS(str(stats)))
