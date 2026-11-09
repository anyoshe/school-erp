"""
Remove non-standard (custom) assessment plans and restore CAT 1–3 + End of Term.

Legacy rows from the old Assessment plans UI can leave subjects like PP1 English
on a custom column set. This command deletes those custom assessments (and their
marks) and recreates the standard markbook columns.

Usage:
  python manage.py reset_standard_markbooks --dry-run
  python manage.py reset_standard_markbooks
  python manage.py reset_standard_markbooks --school-id <uuid>
  python manage.py reset_standard_markbooks --grade PP1 --subject English
"""
from __future__ import annotations

from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from apps.assessments.models import Assessment, Mark
from apps.assessments.presets import (
    STANDARD_CORE_NAMES,
    STANDARD_OPTIONAL_NAMES,
    assessment_names_look_standard,
    ensure_term_assessments,
    preset_columns_for_subject,
)


class Command(BaseCommand):
    help = "Delete custom markbook assessment columns and restore the standard plan"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report only; do not write")
        parser.add_argument("--school-id", type=str, default="", help="Limit to one school UUID")
        parser.add_argument("--grade", type=str, default="", help="Grade name contains (e.g. PP1)")
        parser.add_argument("--subject", type=str, default="", help="Subject name contains (e.g. English)")
        parser.add_argument(
            "--all-subjects",
            action="store_true",
            help="Also re-ensure standard columns on subjects that already look standard",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        qs = Assessment.objects.select_related(
            "school", "academic_year", "term", "grade_level", "subject"
        )
        if options["school_id"]:
            qs = qs.filter(school_id=options["school_id"])
        if options["grade"]:
            qs = qs.filter(grade_level__name__icontains=options["grade"])
        if options["subject"]:
            qs = qs.filter(subject__name__icontains=options["subject"])

        # Group by markbook key
        groups: dict[tuple, list] = defaultdict(list)
        for a in qs.iterator(chunk_size=500):
            key = (
                str(a.school_id),
                a.academic_year_id,
                a.term_id,
                a.grade_level_id,
                str(a.subject_id),
            )
            groups[key].append(a)

        custom_groups = 0
        deleted_assessments = 0
        deleted_marks = 0
        restored = 0

        for key, assessments in groups.items():
            names = {a.name for a in assessments}
            is_standard = assessment_names_look_standard(names)
            # Also treat "has foreign names" as custom even if core is present
            extras = names - STANDARD_CORE_NAMES - STANDARD_OPTIONAL_NAMES
            needs_reset = (not is_standard) or bool(extras)

            if not needs_reset and not options["all_subjects"]:
                continue

            sample = assessments[0]
            label = (
                f"{sample.school.name} · {sample.grade_level.name} · "
                f"{sample.subject.name} · {sample.academic_year.name} · "
                f"{getattr(sample.term, 'name', '—')}"
            )

            if needs_reset:
                custom_groups += 1
                # Delete non-standard named assessments only if mixed; if fully custom, delete all
                if is_standard and extras:
                    to_delete = [a for a in assessments if a.name in extras]
                elif not is_standard:
                    to_delete = list(assessments)
                else:
                    to_delete = []

                ids = [a.id for a in to_delete]
                mark_count = Mark.objects.filter(assessment_id__in=ids).count() if ids else 0
                self.stdout.write(
                    f"{'[dry] ' if dry else ''}RESET {label} "
                    f"names={sorted(names)} delete={len(to_delete)} marks={mark_count}"
                )
                if not dry and to_delete:
                    deleted_marks += Mark.objects.filter(assessment_id__in=ids).count()
                    deleted_assessments += Assessment.objects.filter(id__in=ids).delete()[0]
            else:
                self.stdout.write(f"{'[dry] ' if dry else ''}ENSURE {label}")

            if dry:
                continue

            # Recreate standard columns for this subject/term
            if sample.term_id is None:
                self.stdout.write(self.style.WARNING(f"  skip ensure (no term): {label}"))
                continue
            ensure_term_assessments(
                school=sample.school,
                academic_year=sample.academic_year,
                term=sample.term,
                grade_level=sample.grade_level,
                subject=sample.subject,
            )
            restored += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. custom_groups={custom_groups} "
                f"deleted_assessments={deleted_assessments} deleted_marks={deleted_marks} "
                f"restored={restored} dry={dry}"
            )
        )
        if dry:
            self.stdout.write("Re-run without --dry-run to apply.")
