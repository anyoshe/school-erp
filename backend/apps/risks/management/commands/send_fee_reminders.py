"""SMS fee reminders for open fee-default risks (P0)."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Send SMS fee reminders to guardians for open FEE risks (Africa's Talking if configured)"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--limit", type=int, default=50)

    def handle(self, *args, **options):
        from apps.school.models import School
        from apps.risks.models import RiskAlert
        from apps.core.notify import send_sms
        from apps.attendance.whatsapp import guardian_phone_for_student

        dry = options["dry_run"]
        limit = options["limit"]
        total = 0
        for school in School.objects.all():
            qs = (
                RiskAlert.objects.filter(
                    school=school,
                    status=RiskAlert.Status.OPEN,
                    category=RiskAlert.Category.FEE,
                )
                .select_related("student")
                .order_by("-updated_at")[:limit]
            )
            for risk in qs:
                student = getattr(risk, "student", None)
                if not student:
                    continue
                phone = guardian_phone_for_student(student)
                name = f"{student.first_name or ''} {student.last_name or ''}".strip()
                body = (risk.detail or risk.title or "Please clear outstanding fees")[:160]
                msg = (
                    f"{school.name}: Fee reminder for {name or 'your child'}. "
                    f"{body} Pay at the school office. Thank you."
                )
                if dry:
                    self.stdout.write(f"[dry] {school.name} {phone} {msg[:80]}")
                    total += 1
                    continue
                res = send_sms(phone or "", msg, school=school)
                self.stdout.write(
                    f"{school.name} {phone} ok={res.get('ok')} {res.get('reason')}"
                )
                total += 1
        self.stdout.write(self.style.SUCCESS(f"Processed {total} reminder(s)"))
