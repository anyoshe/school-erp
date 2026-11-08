from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import accessible_school_ids, selected_school
from .grading import grade_label, grading_system_for_school
from .models import Assessment, Mark
from .serializers import AssessmentSerializer, AssessmentWriteSerializer, MarkSerializer


class AssessmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AssessmentWriteSerializer
        return AssessmentSerializer

    def get_queryset(self):
        qs = (
            Assessment.objects.filter(school_id__in=accessible_school_ids(self.request))
            .select_related(
                "academic_year",
                "term",
                "grade_level",
                "subject",
                "section",
            )
            .annotate(
                _marks_count=Count("marks"),
                _entered_count=Count("marks", filter=Q(marks__score__isnull=False)),
            )
        )
        for key, field in (
            ("academic_year", "academic_year_id"),
            ("term", "term_id"),
            ("grade_level", "grade_level_id"),
            ("subject", "subject_id"),
            ("section", "section_id"),
            ("kind", "kind"),
        ):
            val = self.request.query_params.get(key)
            if val:
                if key == "term":
                    qs = qs.filter(Q(term_id=val) | Q(term__isnull=True))
                else:
                    qs = qs.filter(**{field: val})
        return qs.order_by("-assessment_date", "-created_at")

    def perform_create(self, serializer):
        school = selected_school(self.request)
        serializer.save(school=school, created_by=self.request.user)

    def perform_update(self, serializer):
        school = selected_school(self.request)
        serializer.save(school=school)

    @action(detail=True, methods=["get", "post"], url_path="marksheet")
    def marksheet(self, request, pk=None):
        assessment = self.get_object()
        school = assessment.school

        if request.method == "GET":
            from apps.students.models import Student

            students = (
                Student.objects.filter(school=school, current_class=assessment.grade_level)
                .exclude(status__in=["TRANSFERRED", "WITHDRAWN", "GRADUATED"])
                .order_by("last_name", "first_name")
            )
            if assessment.section_id:
                students = students.filter(section_id=assessment.section_id)

            existing = {
                str(m.student_id): m
                for m in Mark.objects.filter(assessment=assessment).select_related(
                    "student",
                    "school",
                    "assessment__grade_level__curriculum",
                )
            }
            rows = []
            for s in students[:500]:
                m = existing.get(str(s.id))
                if m:
                    rows.append(MarkSerializer(m).data)
                else:
                    rows.append(
                        {
                            "id": None,
                            "assessment": str(assessment.id),
                            "student": str(s.id),
                            "student_name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                            "admission_number": s.admission_number or "",
                            "score": None,
                            "is_absent": False,
                            "remarks": "",
                            "percentage": None,
                            "grade_letter": None,
                        }
                    )
            return Response(
                {
                    "assessment": AssessmentSerializer(assessment).data,
                    "rows": rows,
                    "max_score": str(assessment.max_score),
                }
            )

        # POST bulk upsert marks
        marks = request.data.get("marks") or []
        if not isinstance(marks, list):
            return Response({"detail": "marks must be a list"}, status=400)

        saved = 0
        errors = []
        max_s = assessment.max_score

        with transaction.atomic():
            for row in marks:
                sid = row.get("student") or row.get("student_id")
                if not sid:
                    continue
                is_absent = bool(row.get("is_absent"))
                remarks = (row.get("remarks") or "")[:255]
                score = row.get("score")
                if is_absent:
                    score = None
                elif score is not None and score != "":
                    try:
                        score = Decimal(str(score))
                    except (InvalidOperation, TypeError):
                        errors.append({"student": sid, "error": "invalid score"})
                        continue
                    if score < 0 or score > max_s:
                        errors.append(
                            {
                                "student": sid,
                                "error": f"score must be between 0 and {max_s}",
                            }
                        )
                        continue
                else:
                    score = None

                Mark.objects.update_or_create(
                    assessment=assessment,
                    student_id=sid,
                    defaults={
                        "school": school,
                        "score": score,
                        "is_absent": is_absent,
                        "remarks": remarks,
                        "recorded_by": request.user,
                    },
                )
                saved += 1

        return Response({"saved": saved, "errors": errors})


class ClassResultsView(APIView):
    """Simple per-student averages for a grade + term/year (entered marks only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        grade_id = request.query_params.get("grade_level")
        year_id = request.query_params.get("academic_year")
        term_id = request.query_params.get("term")
        if not grade_id:
            return Response({"detail": "grade_level required"}, status=400)

        assessments = Assessment.objects.filter(school=school, grade_level_id=grade_id)
        if year_id:
            assessments = assessments.filter(academic_year_id=year_id)
        if term_id:
            assessments = assessments.filter(term_id=term_id)

        marks = (
            Mark.objects.filter(assessment__in=assessments, is_absent=False, score__isnull=False)
            .select_related(
                "school",
                "assessment",
                "assessment__grade_level__curriculum",
                "assessment__subject",
                "student",
            )
        )

        by_student = {}
        for m in marks:
            key = str(m.student_id)
            bucket = by_student.setdefault(
                key,
                {
                    "student_id": key,
                    "name": f"{m.student.first_name or ''} {m.student.last_name or ''}".strip(),
                    "admission_number": m.student.admission_number or "",
                    "scores": [],
                },
            )
            pct = m.percentage
            if pct is not None:
                bucket["scores"].append(
                    {
                        "assessment": m.assessment.name,
                        "subject": m.assessment.subject.name,
                        "percentage": float(pct),
                        "grade_letter": m.grade_letter,
                    }
                )

        results = []
        for b in by_student.values():
            avg = (
                sum(s["percentage"] for s in b["scores"]) / len(b["scores"])
                if b["scores"]
                else None
            )
            results.append({**b, "average": round(avg, 1) if avg is not None else None})
        results.sort(key=lambda r: (-(r["average"] or 0), r["name"]))

        return Response(
            {
                "grade_level": grade_id,
                "count": len(results),
                "results": results[:300],
            }
        )


def _build_student_report(student, school, academic_year_id=None, term_id=None):
    """Aggregate marks into a printable report-card payload."""
    from apps.academics.models import AcademicYear, Term, GradeLevelSubject

    year = None
    term = None
    if academic_year_id:
        year = AcademicYear.objects.filter(pk=academic_year_id, school=school).first()
    if not year:
        year = AcademicYear.objects.filter(school=school, is_active=True).first()
    if term_id:
        term = Term.objects.filter(pk=term_id).first()
    if not term and year:
        term = year.terms.filter(is_current=True).first() or year.terms.order_by("order").first()

    grade = student.current_class
    section = getattr(student, "section", None)

    assessments = Assessment.objects.filter(school=school)
    if grade:
        assessments = assessments.filter(grade_level=grade)
    if year:
        assessments = assessments.filter(academic_year=year)
    if term:
        assessments = assessments.filter(Q(term=term) | Q(term__isnull=True))

    marks = (
        Mark.objects.filter(
            assessment__in=assessments,
            student=student,
            is_absent=False,
            score__isnull=False,
        )
        .select_related(
            "school",
            "assessment",
            "assessment__grade_level__curriculum",
            "assessment__subject",
        )
        .order_by("assessment__subject__name", "assessment__assessment_date")
    )

    by_subject = {}
    for m in marks:
        subj = m.assessment.subject
        key = str(subj.id)
        bucket = by_subject.setdefault(
            key,
            {
                "subject_id": key,
                "subject_name": subj.name,
                "entries": [],
                "weighted_sum": Decimal("0"),
                "weight_total": Decimal("0"),
            },
        )
        pct = m.percentage
        if pct is None:
            continue
        weight = Decimal(str(m.assessment.weight))
        bucket["entries"].append(
            {
                "assessment": m.assessment.name,
                "kind": m.assessment.kind,
                "score": float(m.score),
                "max_score": float(m.assessment.max_score or 100),
                "percentage": float(pct),
                "grade_letter": m.grade_letter,
                "weight": float(weight),
            }
        )
        bucket["weighted_sum"] += Decimal(str(pct)) * weight
        bucket["weight_total"] += weight

    subjects = []
    overall_sum = Decimal("0")
    overall_n = 0
    for b in sorted(by_subject.values(), key=lambda x: x["subject_name"]):
        avg = None
        if b["weight_total"] > 0:
            avg = float(b["weighted_sum"] / b["weight_total"])
            overall_sum += Decimal(str(avg))
            overall_n += 1
        subjects.append(
            {
                "subject_id": b["subject_id"],
                "subject_name": b["subject_name"],
                "entries": b["entries"],
                "average": round(avg, 1) if avg is not None else None,
                "grade_letter": grade_label(
                    avg,
                    grading_system_for_school(
                        school,
                        grade.curriculum if grade else None,
                    ),
                    school.passing_mark,
                ),
            }
        )

    # Include mapped subjects with no marks yet (so card shows full curriculum)
    if grade:
        mapped = (
            GradeLevelSubject.objects.filter(grade_level=grade)
            .select_related("subject")
            .order_by("order", "subject__name")
        )
        have = {s["subject_id"] for s in subjects}
        for m in mapped:
            sid = str(m.subject_id)
            if sid not in have:
                subjects.append(
                    {
                        "subject_id": sid,
                        "subject_name": m.subject.name,
                        "entries": [],
                        "average": None,
                        "grade_letter": None,
                    }
                )

    overall = float(overall_sum / overall_n) if overall_n else None

    class_teacher_name = None
    if section and getattr(section, "class_teacher", None):
        u = section.class_teacher.user
        class_teacher_name = (
            f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
        )

    return {
        "student": {
            "id": str(student.id),
            "first_name": student.first_name or "",
            "last_name": student.last_name or "",
            "full_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
            "admission_number": student.admission_number or "",
        },
        "school": {
            "id": str(school.id),
            "name": school.name,
            "short_name": getattr(school, "short_name", "") or "",
            "address": getattr(school, "address", "") or "",
            "phone": getattr(school, "phone", "") or "",
            "email": getattr(school, "email", "") or "",
            "logo": None,
            "grading_system": grading_system_for_school(
                school,
                grade.curriculum if grade else None,
            ),
            "passing_mark": school.passing_mark,
        },
        "academic_year": (
            {"id": year.id, "name": year.name} if year else None
        ),
        "term": ({"id": term.id, "name": term.name} if term else None),
        "grade": (
            {"id": grade.id, "name": grade.name} if grade else None
        ),
        "section": (
            {"id": section.id, "name": section.name} if section else None
        ),
        "class_teacher_name": class_teacher_name,
        "subjects": subjects,
        "overall_average": round(overall, 1) if overall is not None else None,
        "overall_grade": grade_label(
            overall,
            grading_system_for_school(
                school,
                grade.curriculum if grade else None,
            ),
            school.passing_mark,
        ),
        "subjects_with_marks": overall_n,
    }


class ReportCardView(APIView):
    """Single student term report card."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        student_id = request.query_params.get("student")
        if not student_id:
            return Response({"detail": "student is required"}, status=400)
        from apps.students.models import Student

        student = (
            Student.objects.filter(
                pk=student_id, school_id__in=accessible_school_ids(request)
            )
            .select_related(
                "current_class",
                "current_class__curriculum",
                "section",
                "section__class_teacher",
                "section__class_teacher__user",
            )
            .first()
        )
        if not student:
            return Response({"detail": "Student not found"}, status=404)

        data = _build_student_report(
            student,
            school,
            academic_year_id=request.query_params.get("academic_year"),
            term_id=request.query_params.get("term"),
        )
        # logo absolute if possible
        if getattr(school, "logo", None):
            try:
                data["school"]["logo"] = request.build_absolute_uri(school.logo.url)
            except Exception:
                data["school"]["logo"] = None
        return Response(data)


class ClassReportCardsView(APIView):
    """Report cards for all learners in a grade/section (batch)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        grade_id = request.query_params.get("grade_level")
        if not grade_id:
            return Response({"detail": "grade_level is required"}, status=400)

        from apps.students.models import Student

        qs = (
            Student.objects.filter(
                school=school,
                current_class_id=grade_id,
            )
            .exclude(status__in=["TRANSFERRED", "WITHDRAWN", "GRADUATED", "PENDING_CLEARANCE"])
            .select_related(
                "current_class",
                "current_class__curriculum",
                "section",
                "section__class_teacher",
                "section__class_teacher__user",
            )
            .order_by("last_name", "first_name")
        )
        section_id = request.query_params.get("section")
        if section_id:
            qs = qs.filter(section_id=section_id)

        cards = []
        for student in qs[:400]:
            card = _build_student_report(
                student,
                school,
                academic_year_id=request.query_params.get("academic_year"),
                term_id=request.query_params.get("term"),
            )
            cards.append(card)

        return Response(
            {
                "count": len(cards),
                "grade_level": grade_id,
                "section": section_id,
                "cards": cards,
            }
        )


class MarksMatrixView(APIView):
    """
    Term markbook for a class + subject, using the configured assessment plan.

    GET returns the configured assessment columns and student rows with scores.

    POST same query filters + body:
         { "marks": [ { "student", "assessment", "score", "is_absent" }, ... ] }
    """

    permission_classes = [IsAuthenticated]

    def _resolve_context(self, request):
        school = selected_school(request)
        if not school:
            return None, Response({"detail": "No school selected"}, status=400)

        from apps.academics.models import AcademicYear, Term, GradeLevel, Subject

        year_id = request.query_params.get("academic_year") or request.data.get("academic_year")
        term_id = request.query_params.get("term") or request.data.get("term")
        grade_id = request.query_params.get("grade_level") or request.data.get("grade_level")
        subject_id = request.query_params.get("subject") or request.data.get("subject")
        section_id = request.query_params.get("section") or request.data.get("section")

        if not all([year_id, term_id, grade_id, subject_id]):
            return None, Response(
                {"detail": "academic_year, term, grade_level and subject are required"},
                status=400,
            )

        year = AcademicYear.objects.filter(pk=year_id, school=school).first()
        term = Term.objects.filter(pk=term_id, academic_year=year).first() if year else None
        grade = GradeLevel.objects.filter(pk=grade_id, school=school).first()
        subject = Subject.objects.filter(pk=subject_id, school=school).first()
        if not all([year, term, grade, subject]):
            return None, Response({"detail": "Invalid year, term, grade or subject"}, status=400)

        return {
            "school": school,
            "year": year,
            "term": term,
            "grade": grade,
            "subject": subject,
            "section_id": section_id,
        }, None

    def _get_assessments(self, ctx):
        assessments = Assessment.objects.filter(
            school=ctx["school"],
            academic_year=ctx["year"],
            grade_level=ctx["grade"],
            subject=ctx["subject"],
        ).filter(Q(term=ctx["term"]) | Q(term__isnull=True))
        if ctx["section_id"]:
            assessments = assessments.filter(
                Q(section__isnull=True) | Q(section_id=ctx["section_id"])
            )
        else:
            assessments = assessments.filter(section__isnull=True)
        return assessments.order_by("assessment_date", "created_at", "name")

    def get(self, request):
        from apps.students.models import Student

        ctx, err = self._resolve_context(request)
        if err:
            return err

        school = ctx["school"]
        assessments = list(self._get_assessments(ctx))

        sort = (request.query_params.get("sort") or "name").lower()
        students = Student.objects.filter(
            school=school, current_class=ctx["grade"]
        ).exclude(
            status__in=["TRANSFERRED", "WITHDRAWN", "GRADUATED", "PENDING_CLEARANCE"]
        )
        if ctx["section_id"]:
            students = students.filter(section_id=ctx["section_id"])
        if sort in ("admission", "admission_number", "adm"):
            students = students.order_by("admission_number", "last_name", "first_name")
        else:
            students = students.order_by("last_name", "first_name", "admission_number")

        students = list(students[:400])
        student_ids = [s.id for s in students]

        marks = Mark.objects.filter(
            assessment__in=assessments,
            student_id__in=student_ids,
        )
        by_key = {(str(m.assessment_id), str(m.student_id)): m for m in marks}

        columns = [
            {
                "id": str(a.id),
                "name": a.name,
                "kind": a.kind,
                "max_score": float(a.max_score),
                "weight": float(a.weight),
            }
            for a in assessments
        ]

        grading_system = grading_system_for_school(
            school,
            ctx["grade"].curriculum,
        )
        passing_mark = int(getattr(school, "passing_mark", None) or 50)

        rows = []
        for s in students:
            cells = {}
            weighted_sum = Decimal("0")
            weight_total = Decimal("0")
            for a in assessments:
                m = by_key.get((str(a.id), str(s.id)))
                score = float(m.score) if m and m.score is not None else None
                is_absent = bool(m.is_absent) if m else False
                pct = None
                if score is not None and a.max_score:
                    pct = round(float(score) / float(a.max_score) * 100, 1)
                    if not is_absent:
                        w = Decimal(str(a.weight))
                        weighted_sum += Decimal(str(pct)) * w
                        weight_total += w
                cells[str(a.id)] = {
                    "score": score,
                    "is_absent": is_absent,
                    "percentage": pct,
                }
            avg = float(weighted_sum / weight_total) if weight_total > 0 else None
            rows.append(
                {
                    "student_id": str(s.id),
                    "admission_number": s.admission_number or "",
                    "name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                    "cells": cells,
                    "average": round(avg, 1) if avg is not None else None,
                    "grade_label": grade_label(avg, grading_system, passing_mark),
                }
            )

        return Response(
            {
                "academic_year": {"id": ctx["year"].id, "name": ctx["year"].name},
                "term": {"id": ctx["term"].id, "name": ctx["term"].name},
                "grade_level": {"id": ctx["grade"].id, "name": ctx["grade"].name},
                "subject": {"id": ctx["subject"].id, "name": ctx["subject"].name},
                "section_id": ctx["section_id"],
                "grading_system": grading_system,
                "passing_mark": passing_mark,
                "columns": columns,
                "rows": rows,
                "assessment_names": [c["name"] for c in columns],
                "preset": [c["name"] for c in columns],
            }
        )

    def post(self, request):
        from apps.students.models import Student

        ctx, err = self._resolve_context(request)
        if err:
            return err

        school = ctx["school"]
        assessments = list(self._get_assessments(ctx))
        assessment_ids = {str(a.id) for a in assessments}
        by_id = {str(a.id): a for a in assessments}

        payload = request.data.get("marks") or []
        if not isinstance(payload, list):
            return Response({"detail": "marks must be a list"}, status=400)

        saved = 0
        errors = []
        with transaction.atomic():
            for row in payload:
                aid = str(row.get("assessment") or "")
                sid = row.get("student") or row.get("student_id")
                if aid not in assessment_ids or not sid:
                    errors.append({"row": row, "detail": "invalid assessment or student"})
                    continue
                assessment = by_id[aid]
                # Ensure student belongs to school/grade
                student_query = Student.objects.filter(
                    pk=sid, school=school, current_class=ctx["grade"]
                )
                if ctx["section_id"]:
                    student_query = student_query.filter(section_id=ctx["section_id"])
                if not student_query.exists():
                    errors.append({"row": row, "detail": "student not in class"})
                    continue

                is_absent = bool(row.get("is_absent"))
                score_raw = row.get("score")
                score = None
                if not is_absent and score_raw not in (None, ""):
                    try:
                        score = Decimal(str(score_raw))
                    except (InvalidOperation, TypeError, ValueError):
                        errors.append({"row": row, "detail": "invalid score"})
                        continue
                    if score < 0 or score > assessment.max_score:
                        errors.append(
                            {
                                "row": row,
                                "detail": f"score must be 0–{assessment.max_score}",
                            }
                        )
                        continue

                Mark.objects.update_or_create(
                    assessment=assessment,
                    student_id=sid,
                    defaults={
                        "school": school,
                        "score": score,
                        "is_absent": is_absent,
                        "remarks": (row.get("remarks") or "")[:255],
                        "recorded_by": request.user if request.user.is_authenticated else None,
                    },
                )
                saved += 1

        return Response({"saved": saved, "errors": errors[:20]})


class DefaultAssessmentPlanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .presets import preset_columns_for_subject

        matrix_view = MarksMatrixView()
        ctx, err = matrix_view._resolve_context(request)
        if err:
            return err

        school = ctx["school"]
        if ctx["section_id"]:
            from apps.academics.models import Section

            if not Section.objects.filter(
                pk=ctx["section_id"], grade_level=ctx["grade"]
            ).exists():
                return Response({"detail": "Invalid section"}, status=400)

        with transaction.atomic():
            if matrix_view._get_assessments(ctx).exists():
                return Response(
                    {"detail": "Assessment plans already exist for this markbook."},
                    status=status.HTTP_409_CONFLICT,
                )

            columns = preset_columns_for_subject(ctx["subject"])
            assessments = [
                Assessment.objects.create(
                    school=school,
                    academic_year=ctx["year"],
                    term=ctx["term"],
                    grade_level=ctx["grade"],
                    subject=ctx["subject"],
                    section=None,
                    name=column["name"],
                    kind=column["kind"],
                    max_score=column["max_score"],
                    weight=column["weight"],
                    created_by=request.user if request.user.is_authenticated else None,
                )
                for column in columns
            ]

        return Response(
            {
                "created": len(assessments),
                "assessment_names": [assessment.name for assessment in assessments],
            },
            status=status.HTTP_201_CREATED,
        )
