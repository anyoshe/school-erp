from datetime import date as date_cls

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.school.support import accessible_school_ids, selected_school
from .models import Attendance, StudentAttendance
from .serializers import (
    AttendanceSerializer,
    AttendanceCreateUpdateSerializer,
    StudentAttendanceSerializer,
)


class AttendanceViewSet(ModelViewSet):
    """Legacy user attendance."""

    queryset = Attendance.objects.select_related("user", "recorded_by").all().order_by("-date")
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if not school.users.filter(pk=serializer.validated_data["user"].pk).exists():
            raise PermissionDenied("Attendance can only be marked for a user in this school.")
        serializer.save(school=school, recorded_by=self.request.user)

    def perform_update(self, serializer):
        school = selected_school(self.request)
        if not school.users.filter(
            pk=serializer.validated_data.get("user", serializer.instance.user).pk
        ).exists():
            raise PermissionDenied("Attendance can only be marked for a user in this school.")
        serializer.save(school=school, recorded_by=self.request.user)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AttendanceCreateUpdateSerializer
        return AttendanceSerializer


class StudentAttendanceViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = StudentAttendance.objects.select_related(
            "student", "grade_level", "section", "recorded_by"
        ).filter(school_id__in=accessible_school_ids(self.request))
        day = self.request.query_params.get("date")
        grade = self.request.query_params.get("grade_level")
        section = self.request.query_params.get("section")
        student = self.request.query_params.get("student")
        if day:
            qs = qs.filter(date=day)
        if grade:
            qs = qs.filter(grade_level_id=grade)
        if section:
            qs = qs.filter(section_id=section)
        if student:
            qs = qs.filter(student_id=student)
        return qs.order_by("student__last_name", "student__first_name")

    def get_serializer_class(self):
        return StudentAttendanceSerializer

    def perform_create(self, serializer):
        school = selected_school(self.request)
        serializer.save(school=school, recorded_by=self.request.user)

    def perform_update(self, serializer):
        school = selected_school(self.request)
        serializer.save(school=school, recorded_by=self.request.user)


class ClassAttendanceSheetView(APIView):
    """
    GET  ?date=&grade_level=&section=  → roster + existing marks
    POST { date, grade_level, section?, marks: [{student_id, status, notes?}] }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)

        day = request.query_params.get("date") or str(date_cls.today())
        grade_id = request.query_params.get("grade_level")
        section_id = request.query_params.get("section")
        if not grade_id:
            return Response({"detail": "grade_level is required"}, status=400)

        from apps.students.models import Student
        from apps.academics.models import GradeLevel, Section

        grade = GradeLevel.objects.filter(pk=grade_id, school=school).first()
        if not grade:
            grade = GradeLevel.objects.filter(pk=grade_id).first()
        if not grade:
            return Response({"detail": "Grade not found"}, status=404)

        section = None
        if section_id:
            section = Section.objects.filter(pk=section_id, grade_level=grade).first()

        students = (
            Student.objects.filter(school=school, current_class=grade)
            .exclude(status__in=["TRANSFERRED", "WITHDRAWN", "GRADUATED"])
            .select_related("section")
            .order_by("last_name", "first_name")
        )
        if section:
            students = students.filter(section=section)

        existing = {
            str(r.student_id): r
            for r in StudentAttendance.objects.filter(
                school=school, date=day, student_id__in=students.values_list("id", flat=True)
            )
        }

        rows = []
        counts = {"PRESENT": 0, "ABSENT": 0, "LATE": 0, "EXCUSED": 0, "UNMARKED": 0}
        for s in students[:500]:
            att = existing.get(str(s.id))
            st = att.status if att else None
            if st:
                counts[st] = counts.get(st, 0) + 1
            else:
                counts["UNMARKED"] += 1
            rows.append(
                {
                    "student_id": str(s.id),
                    "admission_number": s.admission_number or "",
                    "full_name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                    "section_id": str(s.section_id) if s.section_id else None,
                    "section_name": s.section.name if s.section_id and s.section else None,
                    "status": st,
                    "notes": att.notes if att else "",
                    "attendance_id": str(att.id) if att else None,
                }
            )

        return Response(
            {
                "date": day,
                "grade": {"id": grade.id, "name": grade.name},
                "section": (
                    {"id": section.id, "name": section.name} if section else None
                ),
                "counts": counts,
                "students": rows,
            }
        )

    @transaction.atomic
    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)

        day = request.data.get("date") or str(date_cls.today())
        grade_id = request.data.get("grade_level")
        section_id = request.data.get("section")
        marks = request.data.get("marks") or []
        if not grade_id:
            return Response({"detail": "grade_level is required"}, status=400)
        if not isinstance(marks, list) or not marks:
            return Response({"detail": "marks list is required"}, status=400)

        from apps.students.models import Student
        from apps.academics.models import GradeLevel, Section

        grade = GradeLevel.objects.filter(pk=grade_id, school=school).first()
        if not grade:
            return Response({"detail": "Grade not found"}, status=404)
        section = None
        if section_id:
            section = Section.objects.filter(pk=section_id, grade_level=grade).first()

        valid = {c.value for c in StudentAttendance.Status}
        saved = 0
        errors = []
        for row in marks:
            sid = row.get("student_id") or row.get("student")
            st = (row.get("status") or "").upper()
            if not sid or st not in valid:
                errors.append({"student_id": sid, "error": "invalid student or status"})
                continue
            student = Student.objects.filter(pk=sid, school=school).first()
            if not student:
                errors.append({"student_id": sid, "error": "student not found"})
                continue
            obj, _ = StudentAttendance.objects.update_or_create(
                school=school,
                student=student,
                date=day,
                defaults={
                    "status": st,
                    "notes": (row.get("notes") or "")[:255],
                    "grade_level": grade or student.current_class,
                    "section": section or student.section,
                    "recorded_by": request.user,
                },
            )
            saved += 1

        return Response(
            {"date": day, "saved": saved, "errors": errors},
            status=status.HTTP_200_OK,
        )


class AttendanceSummaryView(APIView):
    """Quick counts for a date (school-wide or by grade)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        day = request.query_params.get("date") or str(date_cls.today())
        grade_id = request.query_params.get("grade_level")
        qs = StudentAttendance.objects.filter(school=school, date=day)
        if grade_id:
            qs = qs.filter(grade_level_id=grade_id)
        from django.db.models import Count

        by_status = dict(
            qs.values_list("status").annotate(c=Count("id")).values_list("status", "c")
        )
        return Response(
            {
                "date": day,
                "present": by_status.get("PRESENT", 0),
                "absent": by_status.get("ABSENT", 0),
                "late": by_status.get("LATE", 0),
                "excused": by_status.get("EXCUSED", 0),
                "total_marked": sum(by_status.values()),
            }
        )
