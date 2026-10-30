
"""
Assign / correct fee structures for PENDING_CLEARANCE students from Application enrollment term/year.

Usage:
  python manage.py backfill_clearance_fee_structures --dry-run
  python manage.py backfill_clearance_fee_structures --force
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.db.models.signals import post_save


class Command(BaseCommand):
    help = "Backfill/correct fee_structure for clearance students using enrollment term/year"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--school-id", type=str, default=None)
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-match even when a structure is already linked (fixes wrong Term/Year)",
        )

    def handle(self, *args, **options):
        from apps.students.models import Student
        from apps.finance.clearance import (
            ensure_student_billing,
            find_fee_structure,
            resolve_student_grade,
            fee_structure_matches,
        )
        from apps.finance.models import StudentFeeAssignment, Invoice
        from apps.finance.signals import auto_generate_invoices_on_assignment
        from apps.admissions.models import Application

        dry = options["dry_run"]
        force = options["force"]
        qs = Student.objects.filter(
            Q(status="PENDING_CLEARANCE") | Q(status__iexact="pending_clearance")
        ).select_related("current_class", "school", "fee_structure")

        if options.get("school_id"):
            qs = qs.filter(school_id=options["school_id"])

        assigned = 0
        corrected = 0
        billed = 0
        failed = 0

        # Prevent post_save on StudentFeeAssignment from racing invoice numbers
        post_save.disconnect(
            auto_generate_invoices_on_assignment,
            sender=StudentFeeAssignment,
            dispatch_uid="unique_auto_generate_invoices",
        )
        try:
            for student in qs:
                resolve_student_grade(student)
                student.refresh_from_db()
                app = Application.objects.filter(student=student).only(
                    "enrollment_term", "enrollment_academic_year"
                ).first()
                year = str((app.enrollment_academic_year if app else None) or "").strip() or None
                term = str((app.enrollment_term if app else None) or "").strip() or None

                if not year or not term:
                    failed += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"{student.admission_number}: missing enrollment year/term on application"
                        )
                    )
                    continue

                matched = find_fee_structure(student, year, term)
                current = student.fee_structure
                needs = matched is not None and (
                    current is None
                    or force
                    or not fee_structure_matches(student, current, year, term)
                )

                try:
                    with transaction.atomic():
                        # 1) Drop unpaid invoices first (frees invoice numbers)
                        if not dry:
                            for inv in Invoice.objects.filter(student=student).prefetch_related(
                                "payments"
                            ):
                                if not inv.payments.exists():
                                    inv.delete()

                        if needs and matched:
                            label = f"{matched.name} ({matched.period_name} / {matched.academic_year})"
                            if dry:
                                self.stdout.write(
                                    f"[dry] {student.admission_number}: "
                                    f"{getattr(current, 'name', None)} → {label}"
                                )
                            else:
                                student.fee_structure = matched
                                student.save(update_fields=["fee_structure"])
                                StudentFeeAssignment.objects.update_or_create(
                                    student=student,
                                    defaults={
                                        "fee_structure": matched,
                                        "is_waived": False,
                                    },
                                )
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f"{student.admission_number}: linked {label}"
                                    )
                                )
                            if current is None:
                                assigned += 1
                            else:
                                corrected += 1
                        elif matched is None:
                            failed += 1
                            self.stdout.write(
                                self.style.WARNING(
                                    f"{student.admission_number}: no structure for "
                                    f"grade={getattr(student.current_class, 'name', None)} "
                                    f"term={term} year={year}"
                                )
                            )
                            continue
                        else:
                            self.stdout.write(
                                f"{student.admission_number}: already correct "
                                f"({getattr(current, 'period_name', None)} / "
                                f"{getattr(current, 'academic_year', None)})"
                            )

                        if not dry:
                            ensure_student_billing(
                                student, academic_year=year, period_name=term
                            )
                            billed += 1
                except Exception as e:
                    failed += 1
                    self.stdout.write(
                        self.style.ERROR(f"{student.admission_number}: {e}")
                    )
        finally:
            post_save.connect(
                auto_generate_invoices_on_assignment,
                sender=StudentFeeAssignment,
                dispatch_uid="unique_auto_generate_invoices",
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. assigned={assigned} corrected={corrected} "
                f"billed={billed} failed={failed} dry={dry}"
            )
        )
