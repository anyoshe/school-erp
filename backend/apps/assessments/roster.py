"""Historical class roster for markbooks and report cards."""
from __future__ import annotations

from django.db.models import Q

from apps.students.models import Enrollment, Student


def students_for_grade_period(
    *,
    school,
    grade,
    academic_year=None,
    term=None,
    section_id=None,
    include_inactive_statuses: bool = True,
    limit: int = 500,
    sort: str = "name",
):
    """
    Learners for a grade in a given year/term:
    - currently placed in the grade, OR
    - enrolled in that grade for the academic year, OR
    - have marks on assessments for that grade/year/(term)
    """
    from apps.assessments.models import Mark

    id_set: set = set()

    current_qs = Student.objects.filter(school=school, current_class=grade)
    if not include_inactive_statuses:
        current_qs = current_qs.exclude(
            status__in=["TRANSFERRED", "WITHDRAWN", "GRADUATED", "PENDING_CLEARANCE"]
        )
    id_set.update(current_qs.values_list("id", flat=True))

    if academic_year is not None:
        enr = Enrollment.objects.filter(
            student__school=school,
            grade_level=grade,
            academic_year=academic_year,
        )
        if section_id:
            enr = enr.filter(Q(section_id=section_id) | Q(section__isnull=True))
        id_set.update(enr.values_list("student_id", flat=True))

        marks_f = Q(
            assessment__school=school,
            assessment__grade_level=grade,
            assessment__academic_year=academic_year,
        )
        if term is not None:
            marks_f &= Q(assessment__term=term) | Q(assessment__term__isnull=True)
        id_set.update(
            Mark.objects.filter(marks_f).values_list("student_id", flat=True).distinct()
        )

    if not id_set:
        return []

    qs = Student.objects.filter(school=school, id__in=id_set).select_related(
        "current_class",
        "current_class__curriculum",
        "section",
        "section__class_teacher",
        "section__class_teacher__user",
    )
    if section_id:
        # Prefer section match; still include those with marks/enrollment without section
        qs = qs.filter(Q(section_id=section_id) | Q(section__isnull=True))

    sort = (sort or "name").lower()
    if sort in ("admission", "admission_number", "adm"):
        qs = qs.order_by("admission_number", "last_name", "first_name")
    else:
        qs = qs.order_by("last_name", "first_name", "admission_number")

    return list(qs[:limit])
