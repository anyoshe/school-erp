from decimal import Decimal

from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school, accessible_school_ids
from apps.finance.models import LunchEnrollment
from apps.finance.lunch import (
    ensure_meals_fee_defaults,
    apply_lunch_enrollment_to_assignment,
    ensure_lunch_invoice_line,
    suggested_meals_amount_for_student,
    term_commitment_amount,
    monthly_guide_amount,
    meals_kitty_summary,
    active_lunch_enrollment,
)


class LunchEnrollmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        ensure_meals_fee_defaults(school)
        status_f = (request.query_params.get("status") or "").strip().upper()
        q = (request.query_params.get("q") or "").strip()
        qs = (
            LunchEnrollment.objects.filter(school=school)
            .select_related("student", "student__current_class")
            .order_by("-updated_at")
        )
        if status_f:
            qs = qs.filter(status=status_f)
        if q:
            qs = qs.filter(
                Q(student__admission_number__icontains=q)
                | Q(student__first_name__icontains=q)
                | Q(student__last_name__icontains=q)
            )
        rows = []
        for e in qs[:300]:
            s = e.student
            rows.append(
                {
                    "id": str(e.id),
                    "student_id": str(s.id),
                    "admission_number": s.admission_number,
                    "student_name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                    "grade": s.current_class.name if s.current_class else None,
                    "status": e.status,
                    "plan_type": e.plan_type,
                    "amount": str(e.amount),
                    "absence_rule": e.absence_rule,
                    "academic_year": e.academic_year or "",
                    "start_date": e.start_date.isoformat() if e.start_date else None,
                    "end_date": e.end_date.isoformat() if e.end_date else None,
                    "notes": e.notes or "",
                    "updated_at": e.updated_at.isoformat() if e.updated_at else None,
                }
            )
        return Response({"count": len(rows), "results": rows})

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        ensure_meals_fee_defaults(school)
        from apps.students.models import Student
        from apps.finance.models import StudentFeeAssignment

        student_id = request.data.get("student_id") or request.data.get("student")
        admission = (request.data.get("admission_number") or "").strip()
        student = None
        if student_id:
            student = Student.objects.filter(pk=student_id, school=school).first()
        elif admission:
            student = Student.objects.filter(school=school, admission_number__iexact=admission).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)

        plan_type = (request.data.get("plan_type") or LunchEnrollment.PlanType.TERM).upper()
        if plan_type not in [c.value for c in LunchEnrollment.PlanType]:
            plan_type = LunchEnrollment.PlanType.TERM
        absence = LunchEnrollment.AbsenceRule.CHARGE_FULL  # full package; no day-counting
        try:
            amount = Decimal(str(request.data.get("amount") or "0"))
        except Exception:
            amount = Decimal("0")
        st = (request.data.get("status") or LunchEnrollment.Status.ACTIVE).upper()
        if st not in [c.value for c in LunchEnrollment.Status]:
            st = LunchEnrollment.Status.ACTIVE

        # One active enrollment per student: pause others when creating ACTIVE
        if st == LunchEnrollment.Status.ACTIVE:
            LunchEnrollment.objects.filter(
                school=school, student=student, status=LunchEnrollment.Status.ACTIVE
            ).update(status=LunchEnrollment.Status.ENDED)

        enr = LunchEnrollment.objects.create(
            school=school,
            student=student,
            status=st,
            plan_type=plan_type,
            amount=amount,
            absence_rule=absence,
            academic_year=(request.data.get("academic_year") or "")[:32],
            notes=(request.data.get("notes") or "")[:255],
            created_by=request.user if getattr(request.user, "is_authenticated", False) else None,
        )
        # Full package: select lunch on assignment + bill open invoice (no day counting)
        billing = None
        if st == LunchEnrollment.Status.ACTIVE:
            assignment = StudentFeeAssignment.objects.filter(student=student).first()
            if assignment:
                apply_lunch_enrollment_to_assignment(assignment)
            billing = ensure_lunch_invoice_line(student, user=request.user)

        return Response(
            {
                "id": str(enr.id),
                "student_id": str(student.id),
                "admission_number": student.admission_number,
                "status": enr.status,
                "plan_type": enr.plan_type,
                "amount": str(enr.amount),
                "commitment": str(term_commitment_amount(enr)),
                "monthly_guide": str(monthly_guide_amount(enr)),
                "billing": billing,
            },
            status=status.HTTP_201_CREATED,
        )


class LunchEnrollmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, enrollment_id):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        enr = LunchEnrollment.objects.filter(pk=enrollment_id, school=school).select_related("student").first()
        if not enr:
            return Response({"detail": "Not found"}, status=404)
        data = request.data
        if "status" in data:
            st = str(data.get("status") or "").upper()
            if st in [c.value for c in LunchEnrollment.Status]:
                if st == LunchEnrollment.Status.ACTIVE:
                    LunchEnrollment.objects.filter(
                        school=school,
                        student=enr.student,
                        status=LunchEnrollment.Status.ACTIVE,
                    ).exclude(pk=enr.pk).update(status=LunchEnrollment.Status.ENDED)
                enr.status = st
        if "plan_type" in data:
            pt = str(data.get("plan_type") or "").upper()
            if pt in [c.value for c in LunchEnrollment.PlanType]:
                enr.plan_type = pt
        if "absence_rule" in data:
            ar = str(data.get("absence_rule") or "").upper()
            if ar in [c.value for c in LunchEnrollment.AbsenceRule]:
                enr.absence_rule = ar
        if "amount" in data:
            try:
                enr.amount = Decimal(str(data.get("amount") or 0))
            except Exception:
                pass
        if "academic_year" in data:
            enr.academic_year = str(data.get("academic_year") or "")[:32]
        if "notes" in data:
            enr.notes = str(data.get("notes") or "")[:255]
        enr.save()
        billing = None
        if enr.status == LunchEnrollment.Status.ACTIVE:
            from apps.finance.models import StudentFeeAssignment

            assignment = StudentFeeAssignment.objects.filter(student=enr.student).first()
            if assignment:
                apply_lunch_enrollment_to_assignment(assignment)
            billing = ensure_lunch_invoice_line(enr.student, user=request.user)
        return Response({
            "ok": True,
            "id": str(enr.id),
            "status": enr.status,
            "commitment": str(term_commitment_amount(enr)),
            "monthly_guide": str(monthly_guide_amount(enr)),
            "billing": billing,
        })




class LunchSuggestAmountView(APIView):
    """Default lunch amount from fee structure (adjustable discount on client)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        from apps.students.models import Student

        student_id = request.query_params.get("student_id") or request.query_params.get("student")
        admission = (request.query_params.get("admission_number") or "").strip()
        student = None
        if student_id:
            student = Student.objects.filter(pk=student_id, school=school).first()
        elif admission:
            student = Student.objects.filter(
                school=school, admission_number__iexact=admission
            ).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)
        ensure_meals_fee_defaults(school)
        year = request.query_params.get("academic_year") or request.query_params.get("year")
        term = request.query_params.get("term") or request.query_params.get("period_name")
        sug = suggested_meals_amount_for_student(student, academic_year=year, period_name=term)
        amt = Decimal(str(sug.get("amount") or 0))
        return Response(
            {
                "student_id": str(student.id),
                "admission_number": student.admission_number,
                "amount": float(amt),
                "structure_amount": float(sug.get("structure_amount") or 0),
                "enrollment_amount": float(sug.get("enrollment_amount") or 0),
                "source": sug.get("source"),
                "item_id": sug.get("item_id"),
                "item_name": sug.get("item_name"),
                "structure_id": sug.get("structure_id"),
                "structure_name": sug.get("structure_name"),
                "structure_line_amounts": sug.get("structure_line_amounts") or {},
                "monthly_guide": float((amt / Decimal("3")).quantize(Decimal("0.01")) if amt else 0),
            }
        )

class LunchKittyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        ensure_meals_fee_defaults(school)
        active = LunchEnrollment.objects.filter(
            school=school, status=LunchEnrollment.Status.ACTIVE
        ).count()
        summary = meals_kitty_summary(school)
        summary["active_subscriptions"] = active
        return Response(summary)


class LunchEnsureDefaultsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        result = ensure_meals_fee_defaults(school)
        return Response(
            {
                "ok": True,
                "category_id": result["category"].id,
                "item_id": result["item"].id,
                "category_created": result["category_created"],
                "item_created": result["item_created"],
            }
        )
