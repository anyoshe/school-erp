"""
Year-end promotion / repeat / graduate with fee arrears carry-over.
"""
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError


def next_grade_level(grade):
    if not grade:
        return None
    from apps.academics.models import GradeLevel
    qs = GradeLevel.objects.filter(school_id=grade.school_id, order__gt=grade.order)
    return qs.order_by("order").first()


@transaction.atomic
def promote_student(
    student,
    *,
    academic_year,
    action: str = "PROMOTE",  # PROMOTE | REPEAT | GRADUATE
    target_grade=None,
    section=None,
    pathway=None,
    track=None,
    stream=None,
    carry_fees: bool = True,
    carry_term_label: str = "Term 1",
    user=None,
):
    """
    action:
      PROMOTE  → next grade (or target_grade)
      REPEAT   → same grade, new year enrollment
      GRADUATE → status GRADUATED, no new active enrollment
    """
    from .models import Enrollment
    from apps.finance.carryover import carry_forward_outstanding, student_outstanding

    action = (action or "PROMOTE").upper()
    year_name = getattr(academic_year, "name", None) or str(academic_year)

    # Deactivate prior active enrollments
    Enrollment.objects.filter(student=student, is_active=True).update(is_active=False)

    if action == "GRADUATE":
        student.status = "GRADUATED"
        student.save(update_fields=["status", "updated_at"] if hasattr(student, "updated_at") else ["status"])
        arrears = None
        if carry_fees and student_outstanding(student) > 0:
            arrears = carry_forward_outstanding(
                student,
                academic_year=year_name,
                term="Arrears",
                note="Balance at graduation",
                user=user,
            )
        return {
            "student_id": str(student.id),
            "action": action,
            "status": student.status,
            "arrears_invoice": getattr(arrears, "invoice_number", None),
            "arrears_amount": str(student_outstanding(student)),
        }

    if action == "REPEAT":
        new_grade = target_grade or student.current_class
    else:
        new_grade = target_grade or next_grade_level(student.current_class)
        if not new_grade:
            # No higher grade → graduate
            return promote_student(
                student,
                academic_year=academic_year,
                action="GRADUATE",
                carry_fees=carry_fees,
                user=user,
            )

    # Upsert enrollment for this year
    enrollment, _ = Enrollment.objects.update_or_create(
        student=student,
        academic_year=academic_year,
        defaults={
            "grade_level": new_grade,
            "section": section or student.section,
            "pathway": pathway or student.pathway,
            "track": track or student.track,
            "stream": stream or student.stream,
            "is_active": True,
        },
    )

    student.current_class = new_grade
    if section is not None:
        student.section = section
    if pathway is not None:
        student.pathway = pathway
    if track is not None:
        student.track = track
    if stream is not None:
        student.stream = stream
    if student.status != "ACTIVE":
        student.status = "ACTIVE"
    student.save()

    arrears = None
    outstanding_before = student_outstanding(student)
    if carry_fees and outstanding_before > 0:
        arrears = carry_forward_outstanding(
            student,
            academic_year=year_name,
            term=carry_term_label or "Term 1",
            note=f"Arrears carried into {year_name} ({action})",
            user=user,
        )

    return {
        "student_id": str(student.id),
        "action": action,
        "grade": getattr(new_grade, "name", None),
        "enrollment_id": str(enrollment.id),
        "arrears_invoice": getattr(arrears, "invoice_number", None),
        "arrears_amount": str(outstanding_before if arrears else Decimal("0")),
    }


@transaction.atomic
def carry_term_balances_for_school(
    school,
    *,
    academic_year_label: str,
    to_term: str,
    student_ids=None,
    user=None,
):
    from .models import Student
    from apps.finance.carryover import carry_forward_outstanding, student_outstanding

    qs = Student.objects.filter(school=school, status="ACTIVE")
    if student_ids:
        qs = qs.filter(id__in=student_ids)

    results = []
    for student in qs:
        amt = student_outstanding(student)
        if amt <= 0:
            continue
        inv = carry_forward_outstanding(
            student,
            academic_year=academic_year_label,
            term=to_term,
            note=f"Term balance carried into {to_term}",
            user=user,
        )
        if inv:
            results.append(
                {
                    "student_id": str(student.id),
                    "name": student.full_name,
                    "amount": str(amt),
                    "invoice": inv.invoice_number,
                }
            )
    return results
