"""Bill promoted / returning students only after they report to school."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.tenancy import selected_school


class ReturningStudentsView(APIView):
    """
    List ACTIVE learners enrolled for a year (typically after promotion)
    who still need a fee structure for their new grade — bill only those who report.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)

        from apps.academics.models import AcademicYear, GradeLevel
        from apps.finance.carryover import student_outstanding
        from apps.finance.models import StudentFeeAssignment
        from apps.students.models import Enrollment

        year_id = request.query_params.get("academic_year")
        grade_id = request.query_params.get("grade_level")
        only_unbilled = str(request.query_params.get("only_unbilled") or "1").lower() in (
            "1",
            "true",
            "yes",
        )

        year = None
        if year_id:
            year = AcademicYear.objects.filter(pk=year_id, school=school).first()
        if not year:
            year = AcademicYear.objects.filter(school=school, is_active=True).first()
        if not year:
            return Response({"detail": "No academic year found"}, status=400)

        enr = (
            Enrollment.objects.filter(
                student__school=school,
                academic_year=year,
                student__status="ACTIVE",
            )
            .select_related(
                "student",
                "grade_level",
                "student__fee_assignment",
                "student__fee_assignment__fee_structure",
                "student__fee_assignment__fee_structure__grade_level",
            )
            .order_by("grade_level__order", "student__last_name", "student__first_name")
        )
        if grade_id:
            enr = enr.filter(grade_level_id=grade_id)

        rows = []
        for e in enr[:500]:
            s = e.student
            assignment = getattr(s, "fee_assignment", None)
            structure = getattr(assignment, "fee_structure", None) if assignment else None
            structure_grade_id = getattr(structure, "grade_level_id", None) if structure else None
            matched = bool(structure and structure_grade_id == e.grade_level_id)
            needs_billing = not matched
            if only_unbilled and not needs_billing:
                continue
            outstanding = student_outstanding(s)
            rows.append(
                {
                    "student_id": str(s.id),
                    "admission_number": s.admission_number or "",
                    "name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                    "grade_id": e.grade_level_id,
                    "grade_name": e.grade_level.name if e.grade_level_id else "",
                    "enrollment_id": str(e.id),
                    "has_matching_structure": matched,
                    "structure_name": structure.name if structure else None,
                    "structure_id": str(structure.id) if structure else None,
                    "outstanding": float(outstanding),
                    "needs_billing": needs_billing,
                }
            )

        return Response(
            {
                "academic_year": {"id": year.id, "name": year.name},
                "count": len(rows),
                "results": rows,
            }
        )


class ReturningStudentsBillView(APIView):
    """
    Assign fee structure + generate invoices for selected returning students.
    Optionally fold prior unpaid balances into the new period.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)

        from apps.finance.carryover import carry_forward_outstanding, student_outstanding
        from apps.finance.models import FeeStructure, StudentFeeAssignment
        from apps.finance.signals import regenerate_invoices_for_assignment
        from apps.students.models import Student

        ids = request.data.get("student_ids") or []
        structure_id = request.data.get("fee_structure_id")
        carry = str(request.data.get("carry_balances") or "true").lower() in ("1", "true", "yes")
        if not ids:
            return Response({"detail": "Select at least one student who has reported"}, status=400)
        if not structure_id:
            return Response({"detail": "fee_structure_id is required"}, status=400)

        structure = FeeStructure.objects.filter(pk=structure_id, school=school).first()
        if not structure:
            return Response({"detail": "Fee structure not found"}, status=404)

        students = list(
            Student.objects.filter(school=school, id__in=ids, status="ACTIVE").select_related(
                "fee_assignment"
            )
        )
        if not students:
            return Response({"detail": "No matching active students"}, status=400)

        billed = []
        errors = []
        user = request.user if getattr(request.user, "is_authenticated", False) else None

        for student in students:
            try:
                with transaction.atomic():
                    assignment, _ = StudentFeeAssignment.objects.update_or_create(
                        student=student,
                        defaults={
                            "fee_structure": structure,
                            "assigned_by": user,
                        },
                    )
                    student.fee_structure = structure
                    student.save(update_fields=["fee_structure"])
                    try:
                        regenerate_invoices_for_assignment(assignment)
                    except Exception as e:
                        # Still keep assignment even if regen partially fails
                        print(f"[returning-bill] invoice regen {student.id}: {e}")

                    arrears_inv = None
                    outstanding = student_outstanding(student)
                    if carry and outstanding > 0:
                        arrears_inv = carry_forward_outstanding(
                            student,
                            academic_year=structure.academic_year or "",
                            term=structure.period_name or "Term 1",
                            note=f"Balance carried when billing returning student ({structure.name})",
                            user=user,
                        )
                    billed.append(
                        {
                            "student_id": str(student.id),
                            "name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
                            "structure": structure.name,
                            "outstanding_before_carry": float(outstanding),
                            "arrears_invoice": getattr(arrears_inv, "invoice_number", None),
                        }
                    )
            except Exception as e:
                errors.append({"student_id": str(student.id), "detail": str(e)})

        return Response(
            {
                "billed": len(billed),
                "results": billed,
                "errors": errors[:20],
                "structure": {
                    "id": str(structure.id),
                    "name": structure.name,
                    "grade": getattr(structure.grade_level, "name", None),
                    "period": structure.period_name,
                    "year": structure.academic_year,
                },
            }
        )
