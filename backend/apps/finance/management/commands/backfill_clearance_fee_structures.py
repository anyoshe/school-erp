
"""
Assign fee structures + invoices for students awaiting finance clearance.

Usage:
  python manage.py backfill_clearance_fee_structures --dry-run
  python manage.py backfill_clearance_fee_structures
  python manage.py backfill_clearance_fee_structures --school-id <uuid>
"""
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = "Backfill fee_structure and billing for PENDING_CLEARANCE / clearance queue students"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default=None)

    def handle(self, *args, **options):
        from apps.students.models import Student
        from apps.finance.clearance import ensure_student_billing, find_fee_structure, resolve_student_grade
        from apps.admissions.models import Application

        dry = options["dry_run"]
        qs = Student.objects.filter(
            Q(status="PENDING_CLEARANCE") | Q(status__iexact="pending_clearance")
        ).select_related("current_class", "school", "fee_structure")

        # Also students with no fee_structure that still look like new admits
        extra = Student.objects.filter(fee_structure__isnull=True).exclude(
            id__in=qs.values_list("id", flat=True)
        )
        # Prefer those linked from applications enrolled
        app_student_ids = Application.objects.filter(
            status="ENROLLED", student__isnull=False
        ).values_list("student_id", flat=True)
        extra = extra.filter(id__in=app_student_ids)
        qs = (qs | extra).distinct()

        if options.get("school_id"):
            qs = qs.filter(school_id=options["school_id"])

        assigned = 0
        billed = 0
        failed = 0

        for student in qs:
            resolve_student_grade(student)
            student.refresh_from_db()
            app = Application.objects.filter(student=student).only(
                "enrollment_term", "enrollment_academic_year"
            ).first()
            year = app.enrollment_academic_year if app else None
            term = app.enrollment_term if app else None

            structure = student.fee_structure
            if structure is None:
                structure = find_fee_structure(student, year, term)
                if structure and not dry:
                    student.fee_structure = structure
                    student.save(update_fields=["fee_structure"])
                    assigned += 1
                    self.stdout.write(
                        f"Assigned {structure.name} → {student.admission_number} "
                        f"({getattr(student.current_class, 'name', '?')})"
                    )
                elif structure and dry:
                    assigned += 1
                    self.stdout.write(
                        f"[dry] would assign {structure.name} → {student.admission_number}"
                    )
                else:
                    failed += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"No structure for {student.admission_number} "
                            f"grade={getattr(student.current_class, 'name', None)} "
                            f"term={term} year={year}"
                        )
                    )
                    continue

            if not dry:
                try:
                    ensure_student_billing(
                        student, academic_year=year, period_name=term
                    )
                    billed += 1
                except Exception as e:
                    failed += 1
                    self.stdout.write(self.style.ERROR(f"Billing failed {student.admission_number}: {e}"))
            else:
                billed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. structures_assigned={assigned} billed={billed} failed={failed} dry={dry}"
            )
        )
