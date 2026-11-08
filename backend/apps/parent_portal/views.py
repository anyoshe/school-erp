from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school


def _guardian_profile(user, school):
    from .models import GuardianProfile

    return GuardianProfile.objects.filter(user=user, school=school).first()


class ParentChildrenView(APIView):
    """List learners linked to the logged-in parent at the current school."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        profile = _guardian_profile(request.user, school)
        if not profile:
            # Auto-link attempt by phone/email to StudentGuardian records
            profile = self._auto_provision(request.user, school)
        if not profile:
            return Response(
                {
                    "children": [],
                    "detail": "No parent profile linked. Ask the school to link your account.",
                }
            )
        from .models import ParentStudentLink

        links = (
            ParentStudentLink.objects.filter(guardian_profile=profile, school=school)
            .select_related("student", "student__current_class", "student__section")
            .order_by("student__last_name")
        )
        children = []
        for link in links:
            s = link.student
            children.append(
                {
                    "id": str(s.id),
                    "admission_number": s.admission_number,
                    "full_name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                    "grade": s.current_class.name if s.current_class else None,
                    "section": s.section.name if s.section else None,
                    "status": s.status,
                    "is_primary_contact": link.is_primary,
                }
            )
        return Response({"children": children, "guardian": profile.full_name})

    def _auto_provision(self, user, school):
        """Create profile + links when guardian phone/email matches student guardians."""
        from .models import GuardianProfile, ParentStudentLink
        from apps.students.models import Guardian, StudentGuardian

        phone = (getattr(user, "phone", None) or "").strip()
        email = (user.email or "").strip().lower()
        qs = Guardian.objects.filter(school=school)
        if phone:
            qs = qs.filter(phone__icontains=phone[-9:]) if len(phone) >= 9 else qs.filter(phone=phone)
        elif email:
            qs = qs.filter(email__iexact=email)
        else:
            return None
        guardian_rows = list(qs[:5])
        if not guardian_rows:
            return None
        g0 = guardian_rows[0]
        profile, _ = GuardianProfile.objects.get_or_create(
            user=user,
            defaults={
                "school": school,
                "full_name": g0.full_name or user.get_full_name() or user.email,
                "phone": g0.phone or phone,
                "email": g0.email or email,
            },
        )
        if profile.school_id != school.id:
            return profile
        for g in guardian_rows:
            for sg in StudentGuardian.objects.filter(guardian=g, is_active=True).select_related("student"):
                if sg.student.school_id == school.id:
                    ParentStudentLink.objects.get_or_create(
                        school=school,
                        guardian_profile=profile,
                        student=sg.student,
                        defaults={"is_primary": sg.is_primary},
                    )
        return profile


class ParentChildResultsView(APIView):
    """Report-card style results for one linked child."""

    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        from .models import ParentStudentLink, GuardianProfile
        from apps.students.models import Student
        from apps.assessments.views import _build_student_report

        profile = GuardianProfile.objects.filter(user=request.user, school=school).first()
        if not profile:
            return Response({"detail": "Parent profile not found"}, status=403)
        link = ParentStudentLink.objects.filter(
            guardian_profile=profile, student_id=student_id, school=school
        ).first()
        if not link:
            return Response({"detail": "Child not linked to this parent"}, status=403)
        student = Student.objects.filter(pk=student_id, school=school).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)
        card = _build_student_report(
            student,
            school,
            academic_year_id=request.query_params.get("academic_year"),
            term_id=request.query_params.get("term"),
        )
        return Response(card)


class ParentLinkStudentView(APIView):
    """School staff: link a parent user to a student by admission number."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        role = getattr(request.user, "role", "") or ""
        if role in ("PARENT", "STUDENT"):
            return Response({"detail": "Staff only"}, status=403)

        from apps.accounts.models import User
        from apps.students.models import Student
        from .models import GuardianProfile, ParentStudentLink

        user_id = request.data.get("user_id")
        email = (request.data.get("email") or "").strip().lower()
        admission = (request.data.get("admission_number") or "").strip()
        if not admission or (not user_id and not email):
            return Response(
                {"detail": "admission_number and user_id or email required"},
                status=400,
            )
        student = Student.objects.filter(school=school, admission_number__iexact=admission).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)
        user = None
        if user_id:
            user = User.objects.filter(pk=user_id).first()
        elif email:
            user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "Parent user not found"}, status=404)

        profile, _ = GuardianProfile.objects.get_or_create(
            user=user,
            defaults={
                "school": school,
                "full_name": user.get_full_name() or user.email,
                "phone": getattr(user, "phone", "") or "",
                "email": user.email or "",
            },
        )
        link, created = ParentStudentLink.objects.get_or_create(
            school=school,
            guardian_profile=profile,
            student=student,
            defaults={"is_primary": True},
        )
        return Response(
            {
                "linked": True,
                "created": created,
                "student": student.admission_number,
                "parent": user.email,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
