"""Timetable MVP: periods + section grid entries."""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school

from .models import Period, Section, Subject, TimetableEntry


def _school(request):
    return selected_school(request)


class PeriodListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = Period.objects.filter(school=school).order_by("order", "id")
        return Response(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "order": p.order,
                    "start_time": p.start_time.isoformat() if p.start_time else None,
                    "end_time": p.end_time.isoformat() if p.end_time else None,
                    "is_break": p.is_break,
                }
                for p in qs
            ]
        )

    def post(self, request):
        school = _school(request)
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"detail": "name is required"}, status=400)
        order = int(request.data.get("order") or (Period.objects.filter(school=school).count() + 1))
        p = Period.objects.create(
            school=school,
            name=name,
            order=order,
            start_time=request.data.get("start_time") or None,
            end_time=request.data.get("end_time") or None,
            is_break=bool(request.data.get("is_break")),
        )
        return Response({"id": p.id, "name": p.name, "order": p.order}, status=201)


class PeriodSeedDefaultsView(APIView):
    """Create a standard 8-period day if school has no periods yet."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = _school(request)
        if Period.objects.filter(school=school).exists():
            return Response({"detail": "Periods already exist", "created": 0})
        defaults = [
            ("P1", 1, "08:00", "08:40", False),
            ("P2", 2, "08:40", "09:20", False),
            ("Break", 3, "09:20", "09:40", True),
            ("P3", 4, "09:40", "10:20", False),
            ("P4", 5, "10:20", "11:00", False),
            ("Lunch", 6, "11:00", "12:00", True),
            ("P5", 7, "12:00", "12:40", False),
            ("P6", 8, "12:40", "13:20", False),
        ]
        from datetime import time as time_cls

        created = 0
        for name, order, st, et, br in defaults:
            sh, sm = map(int, st.split(":"))
            eh, em = map(int, et.split(":"))
            Period.objects.create(
                school=school,
                name=name,
                order=order,
                start_time=time_cls(sh, sm),
                end_time=time_cls(eh, em),
                is_break=br,
            )
            created += 1
        return Response({"created": created})


class TimetableGridView(APIView):
    """GET grid for a section; POST upsert one cell; DELETE remove cell."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        section_id = request.query_params.get("section_id")
        if not section_id:
            return Response({"detail": "section_id required"}, status=400)
        section = Section.objects.filter(pk=section_id, grade_level__school=school).first()
        if not section:
            return Response({"detail": "Section not found"}, status=404)
        year_id = request.query_params.get("academic_year_id")
        periods = list(Period.objects.filter(school=school).order_by("order"))
        qs = TimetableEntry.objects.filter(school=school, section=section).select_related(
            "period", "subject", "teacher"
        )
        if year_id:
            qs = qs.filter(academic_year_id=year_id)
        entries = [
            {
                "id": e.id,
                "weekday": e.weekday,
                "period_id": e.period_id,
                "subject_id": e.subject_id,
                "subject_name": e.subject.name if e.subject_id else "",
                "teacher_id": e.teacher_id,
                "teacher_name": str(e.teacher) if e.teacher_id else "",
                "room": e.room,
            }
            for e in qs
        ]
        return Response(
            {
                "section_id": section.id,
                "section_name": getattr(section, "name", str(section)),
                "periods": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "order": p.order,
                        "is_break": p.is_break,
                        "start_time": p.start_time.isoformat() if p.start_time else None,
                        "end_time": p.end_time.isoformat() if p.end_time else None,
                    }
                    for p in periods
                ],
                "entries": entries,
                "weekdays": [
                    {"id": 1, "label": "Mon"},
                    {"id": 2, "label": "Tue"},
                    {"id": 3, "label": "Wed"},
                    {"id": 4, "label": "Thu"},
                    {"id": 5, "label": "Fri"},
                ],
            }
        )

    def post(self, request):
        school = _school(request)
        section_id = request.data.get("section_id")
        period_id = request.data.get("period_id")
        weekday = request.data.get("weekday")
        subject_id = request.data.get("subject_id")
        if not all([section_id, period_id, weekday, subject_id]):
            return Response(
                {"detail": "section_id, period_id, weekday, subject_id required"},
                status=400,
            )
        section = Section.objects.filter(pk=section_id, grade_level__school=school).first()
        period = Period.objects.filter(pk=period_id, school=school).first()
        subject = Subject.objects.filter(pk=subject_id, school=school).first()
        if not section or not period or not subject:
            return Response({"detail": "Invalid section, period, or subject"}, status=400)
        if period.is_break:
            return Response({"detail": "Cannot assign a subject to a break period"}, status=400)
        year_id = request.data.get("academic_year_id") or None
        teacher_id = request.data.get("teacher_id") or None
        room = (request.data.get("room") or "")[:60]
        defaults = {
            "subject": subject,
            "teacher_id": teacher_id,
            "room": room,
            "school": school,
        }
        entry, created = TimetableEntry.objects.update_or_create(
            section=section,
            weekday=int(weekday),
            period=period,
            academic_year_id=year_id,
            defaults=defaults,
        )
        return Response(
            {
                "id": entry.id,
                "created": created,
                "weekday": entry.weekday,
                "period_id": entry.period_id,
                "subject_id": entry.subject_id,
            },
            status=201 if created else 200,
        )

    def delete(self, request):
        school = _school(request)
        entry_id = request.query_params.get("id") or request.data.get("id")
        if not entry_id:
            return Response({"detail": "id required"}, status=400)
        deleted, _ = TimetableEntry.objects.filter(pk=entry_id, school=school).delete()
        if not deleted:
            return Response({"detail": "Not found"}, status=404)
        return Response(status=204)
