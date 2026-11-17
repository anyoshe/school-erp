"""Timetable: periods + section weekly grid."""
from __future__ import annotations

from datetime import datetime, time as time_cls

from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school

from .models import Period, Section, Subject, SubjectTeacher, TimetableEntry


def _school(request):
    school = selected_school(request)
    if school is None:
        from rest_framework.exceptions import ValidationError

        raise ValidationError({"detail": "School context required (X-School-ID)."})
    return school


def _parse_time(value):
    if value is None or value == "":
        return None
    if isinstance(value, time_cls):
        return value
    s = str(value).strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s[:8], fmt).time()
        except ValueError:
            continue
    return None


def _period_payload(p: Period) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "order": p.order,
        "start_time": p.start_time.strftime("%H:%M") if p.start_time else None,
        "end_time": p.end_time.strftime("%H:%M") if p.end_time else None,
        "is_break": p.is_break,
    }


DEFAULT_PERIODS = [
    ("P1", 1, "08:00", "08:40", False),
    ("P2", 2, "08:40", "09:20", False),
    ("Break", 3, "09:20", "09:40", True),
    ("P3", 4, "09:40", "10:20", False),
    ("P4", 5, "10:20", "11:00", False),
    ("Lunch", 6, "11:00", "12:00", True),
    ("P5", 7, "12:00", "12:40", False),
    ("P6", 8, "12:40", "13:20", False),
    ("P7", 9, "13:20", "14:00", False),
    ("P8", 10, "14:00", "14:40", False),
]


def seed_periods_for_school(school, *, force: bool = False) -> dict:
    """
    Idempotent period seed.
    force=False: create only when school has zero periods.
    force=True: add any missing default names (never deletes user periods).
    """
    existing = {p.name.lower(): p for p in Period.objects.filter(school=school)}
    if existing and not force:
        return {
            "created": 0,
            "skipped": len(existing),
            "total": len(existing),
            "detail": "Periods already exist",
        }

    created = 0
    for name, order, st, et, br in DEFAULT_PERIODS:
        key = name.lower()
        if key in existing:
            continue
        Period.objects.create(
            school=school,
            name=name,
            order=order,
            start_time=_parse_time(st),
            end_time=_parse_time(et),
            is_break=br,
        )
        created += 1
    total = Period.objects.filter(school=school).count()
    return {
        "created": created,
        "skipped": max(total - created, 0),
        "total": total,
        "detail": f"Created {created} period(s)" if created else "No new periods needed",
    }


class PeriodListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = Period.objects.filter(school=school).order_by("order", "id")
        return Response([_period_payload(p) for p in qs])

    def post(self, request):
        school = _school(request)
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"detail": "name is required"}, status=400)
        if Period.objects.filter(school=school, name__iexact=name).exists():
            return Response({"detail": f'Period "{name}" already exists'}, status=400)
        order = request.data.get("order")
        if order is None or order == "":
            order = (Period.objects.filter(school=school).count() or 0) + 1
        p = Period.objects.create(
            school=school,
            name=name,
            order=int(order),
            start_time=_parse_time(request.data.get("start_time")),
            end_time=_parse_time(request.data.get("end_time")),
            is_break=bool(request.data.get("is_break")),
        )
        return Response(_period_payload(p), status=201)


class PeriodDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        school = _school(request)
        p = Period.objects.filter(pk=pk, school=school).first()
        if not p:
            return Response({"detail": "Not found"}, status=404)
        if "name" in request.data and str(request.data.get("name") or "").strip():
            p.name = str(request.data.get("name")).strip()
        if "order" in request.data and request.data.get("order") not in (None, ""):
            p.order = int(request.data.get("order"))
        if "start_time" in request.data:
            p.start_time = _parse_time(request.data.get("start_time"))
        if "end_time" in request.data:
            p.end_time = _parse_time(request.data.get("end_time"))
        if "is_break" in request.data:
            p.is_break = bool(request.data.get("is_break"))
        p.save()
        return Response(_period_payload(p))

    def delete(self, request, pk):
        school = _school(request)
        p = Period.objects.filter(pk=pk, school=school).first()
        if not p:
            return Response({"detail": "Not found"}, status=404)
        p.delete()
        return Response(status=204)


class PeriodSeedDefaultsView(APIView):
    """Seed standard day periods for the school (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = _school(request)
        force = str(request.data.get("force") or request.query_params.get("force") or "").lower() in (
            "1",
            "true",
            "yes",
        )
        result = seed_periods_for_school(school, force=force)
        status_code = 201 if result.get("created") else 200
        return Response(result, status=status_code)


class TimetableGridView(APIView):
    """GET grid for a section; POST upsert one cell; DELETE remove cell."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        section_id = request.query_params.get("section_id")
        if not section_id:
            return Response({"detail": "section_id required"}, status=400)

        section = (
            Section.objects.filter(pk=section_id, grade_level__school=school)
            .select_related("grade_level")
            .first()
        )
        if not section:
            return Response({"detail": "Section not found for this school"}, status=404)

        auto_seeded = None
        if not Period.objects.filter(school=school).exists():
            auto_seeded = seed_periods_for_school(school, force=False)

        year_id = request.query_params.get("academic_year_id") or None
        periods = list(Period.objects.filter(school=school).order_by("order", "id"))
        qs = TimetableEntry.objects.filter(school=school, section=section).select_related(
            "period", "subject", "teacher"
        )
        if year_id:
            qs = qs.filter(academic_year_id=year_id)
        else:
            qs = qs.filter(academic_year__isnull=True)

        entries = []
        for e in qs:
            teacher_name = ""
            if e.teacher_id:
                t = e.teacher
                teacher_name = (
                    getattr(t, "full_name", None)
                    or " ".join(
                        filter(
                            None,
                            [getattr(t, "first_name", ""), getattr(t, "last_name", "")],
                        )
                    ).strip()
                    or str(t)
                )
            entries.append(
                {
                    "id": e.id,
                    "weekday": e.weekday,
                    "period_id": e.period_id,
                    "subject_id": e.subject_id,
                    "subject_name": e.subject.name if e.subject_id else "",
                    "subject_code": getattr(e.subject, "short_name", "")
                    or getattr(e.subject, "code", "")
                    or "",
                    "teacher_id": e.teacher_id,
                    "teacher_name": teacher_name,
                    "room": e.room or "",
                }
            )

        grade_name = section.grade_level.name if section.grade_level_id else ""
        return Response(
            {
                "section_id": section.id,
                "section_name": section.name,
                "grade_name": grade_name,
                "display_name": f"{grade_name} — {section.name}".strip(" —")
                if grade_name
                else section.name,
                "periods": [_period_payload(p) for p in periods],
                "entries": entries,
                "weekdays": [
                    {"id": 1, "label": "Mon"},
                    {"id": 2, "label": "Tue"},
                    {"id": 3, "label": "Wed"},
                    {"id": 4, "label": "Thu"},
                    {"id": 5, "label": "Fri"},
                ],
                "auto_seeded": auto_seeded,
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
        subject = (
            Subject.objects.filter(pk=subject_id)
            .filter(Q(school=school) | Q(school__isnull=True))
            .first()
        )
        if not subject:
            subject = Subject.objects.filter(pk=subject_id, school=school).first()

        if not section or not period or not subject:
            return Response({"detail": "Invalid section, period, or subject"}, status=400)
        if period.is_break:
            return Response({"detail": "Cannot assign a subject to a break period"}, status=400)

        try:
            weekday_i = int(weekday)
        except (TypeError, ValueError):
            return Response({"detail": "weekday must be 1–6"}, status=400)
        if weekday_i < 1 or weekday_i > 6:
            return Response({"detail": "weekday must be 1–6"}, status=400)

        year_id = request.data.get("academic_year_id") or None
        teacher_id = request.data.get("teacher_id") or None
        room = (request.data.get("room") or "")[:60]

        if not teacher_id and section.grade_level_id:
            st_qs = SubjectTeacher.objects.filter(
                school=school,
                subject=subject,
                grade_level_id=section.grade_level_id,
                is_active=True,
            )
            if year_id:
                st_qs = st_qs.filter(academic_year_id=year_id)
            st = st_qs.select_related("teacher").first()
            if st and st.teacher_id:
                teacher_id = st.teacher_id

        defaults = {
            "subject": subject,
            "teacher_id": teacher_id,
            "room": room,
            "school": school,
        }

        entry, created = TimetableEntry.objects.update_or_create(
            section=section,
            weekday=weekday_i,
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
                "teacher_id": entry.teacher_id,
                "room": entry.room,
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


class TimetableClearSectionView(APIView):
    """Clear all entries for a section (optional weekday)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = _school(request)
        section_id = request.data.get("section_id")
        if not section_id:
            return Response({"detail": "section_id required"}, status=400)
        section = Section.objects.filter(pk=section_id, grade_level__school=school).first()
        if not section:
            return Response({"detail": "Section not found"}, status=404)
        qs = TimetableEntry.objects.filter(school=school, section=section)
        weekday = request.data.get("weekday")
        if weekday not in (None, ""):
            qs = qs.filter(weekday=int(weekday))
        deleted, _ = qs.delete()
        return Response({"deleted": deleted})


class TimetableSectionsView(APIView):
    """Sections for timetable picker, with grade labels."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = (
            Section.objects.filter(grade_level__school=school, is_active=True)
            .select_related("grade_level")
            .order_by("grade_level__order", "grade_level__name", "name")
        )
        grade_id = request.query_params.get("grade_level_id")
        if grade_id:
            qs = qs.filter(grade_level_id=grade_id)
        return Response(
            [
                {
                    "id": s.id,
                    "name": s.name,
                    "grade_level_id": s.grade_level_id,
                    "grade_name": s.grade_level.name if s.grade_level_id else "",
                    "label": f"{s.grade_level.name} — {s.name}" if s.grade_level_id else s.name,
                }
                for s in qs
            ]
        )
