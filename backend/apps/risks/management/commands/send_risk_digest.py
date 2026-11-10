from django.core.management.base import BaseCommand

from apps.risks.digest import send_digest
from apps.risks.scan import scan_school


class Command(BaseCommand):
    help = "Scan risks and send morning digest (LOG by default; use --channel WHATSAPP|EMAIL|BOTH)"

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=str, default=None)
        parser.add_argument(
            "--channel",
            type=str,
            default=None,
            help="LOG | WHATSAPP | EMAIL | BOTH (default env RISK_DIGEST_CHANNEL or LOG)",
        )
        parser.add_argument("--force", action="store_true", help="Resend even if already sent today")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--limit", type=int, default=5)

    def handle(self, *args, **options):
        from apps.school.models import School

        qs = School.objects.all()
        if options.get("school_id"):
            qs = qs.filter(pk=options["school_id"])
        n = 0
        for school in qs.iterator():
            try:
                scan_school(school)
            except Exception as exc:
                self.stderr.write(f"scan failed {school.id}: {exc}")
            result = send_digest(
                school,
                channel=options.get("channel"),
                limit=options.get("limit") or 5,
                force=bool(options.get("force")),
                dry_run=bool(options.get("dry_run")),
            )
            self.stdout.write(str(result))
            n += 1
        self.stdout.write(self.style.SUCCESS(f"Digest processed for {n} school(s)"))
