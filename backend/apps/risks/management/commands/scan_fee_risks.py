from django.core.management.base import BaseCommand

from apps.risks.fee_scan import scan_all_schools, scan_fee_risks_for_school


class Command(BaseCommand):
    help = "Scan fee early-warning rules and upsert RiskAlert rows"

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=str, default=None)

    def handle(self, *args, **options):
        sid = options.get("school_id")
        if sid:
            from apps.school.models import School

            school = School.objects.filter(pk=sid).first()
            if not school:
                self.stderr.write("School not found")
                return
            result = scan_fee_risks_for_school(school)
            self.stdout.write(self.style.SUCCESS(str(result)))
            return
        results = scan_all_schools()
        for r in results:
            self.stdout.write(str(r))
        self.stdout.write(self.style.SUCCESS(f"Scanned {len(results)} school(s)"))
