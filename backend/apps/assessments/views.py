import csv
import io
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import accessible_school_ids, selected_school
from .grading import grade_label, grade_descriptor, grading_system_for_school
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


def _school_print_branding(school, request=None):
    """Name, contacts, and logo URL for printable documents."""
    logo = None
    if getattr(school, "logo", None):
        try:
            url = school.logo.url
            if request is not None and url and not str(url).startswith("http"):
                logo = request.build_absolute_uri(url)
            else:
                logo = url
        except Exception:
            logo = None
    return {
        "id": str(school.id),
        "name": school.name,
        "short_name": getattr(school, "short_name", "") or "",
        "address": getattr(school, "address", "") or "",
        "phone": getattr(school, "phone", "") or "",
        "email": getattr(school, "email", "") or "",
        "motto": getattr(school, "motto", "") or "",
        "logo": logo,
    }



def _attach_class_position(card, student, school, year, term, grade):
    """Rank this learner against classmates for the same year/term/grade."""
    if not card or card.get("overall_average") is None or not grade or not year:
        card["position"] = card.get("position")
        card["out_of"] = card.get("out_of")
        return card

    from apps.students.models import Student

    section_id = None
    sec = card.get("section")
    if isinstance(sec, dict):
        section_id = sec.get("id")

    peers = []
    try:
        from apps.assessments.roster import students_for_grade_period
        peers = list(
            students_for_grade_period(
                school=school,
                grade=grade,
                academic_year=year,
                term=term,
                section_id=section_id,
                include_inactive_statuses=True,
                limit=400,
                sort="name",
            )
        )
    except Exception:
        peers = []

    if not peers:
        qs = Student.objects.filter(school=school, current_class_id=getattr(grade, "id", None))
        qs = qs.exclude(status__in=["WITHDRAWN", "TRANSFERRED", "GRADUATED", "ALUMNI"])
        if section_id:
            qs = qs.filter(section_id=section_id)
        peers = list(qs[:400])

    if not peers:
        peers = [student]

    prev_skip = getattr(_build_student_report, "_skip_position", False)
    _build_student_report._skip_position = True
    averages = []
    try:
        for peer in peers:
            if str(getattr(peer, "id", "")) == str(getattr(student, "id", "")):
                avg = card.get("overall_average")
            else:
                peer_card = _build_student_report(
                    peer,
                    school,
                    academic_year_id=getattr(year, "id", None),
                    term_id=getattr(term, "id", None) if term else None,
                    grade_level_id=getattr(grade, "id", None),
                )
                avg = peer_card.get("overall_average")
            if avg is not None:
                averages.append(
                    (
                        str(getattr(peer, "id", "")),
                        float(avg),
                        (getattr(peer, "last_name", None) or ""),
                    )
                )
    finally:
        _build_student_report._skip_position = prev_skip

    averages.sort(key=lambda x: (-x[1], x[2]))
    out_of = len(averages)
    rank = None
    prev = None
    pos = 0
    sid = str(getattr(student, "id", ""))
    for i, (pid, avg, _) in enumerate(averages, start=1):
        if prev is None or avg != prev:
            pos = i
        prev = avg
        if pid == sid:
            rank = pos
            break
    card["position"] = rank
    card["out_of"] = out_of or None
    return card


def _build_student_report(
    student,
    school,
    academic_year_id=None,
    term_id=None,
    grade_level_id=None,
):
    """Aggregate marks into a printable report-card payload.

    grade_level_id: when set (class report cards / historical class), load marks
    for *that* grade — not student.current_class — so promoted learners still
    show prior-term results.
    """
    from apps.academics.models import AcademicYear, Term, GradeLevel, GradeLevelSubject
    from apps.students.models import Enrollment

    year = None
    term = None
    if academic_year_id:
        year = AcademicYear.objects.filter(pk=academic_year_id, school=school).first()
    if not year:
        year = AcademicYear.objects.filter(school=school, is_active=True).first()
    if term_id:
        term = Term.objects.filter(pk=term_id, academic_year__school=school).first()
    if not term and year:
        term = year.terms.filter(is_current=True).first() or year.terms.order_by("order").first()

    grade = None
    if grade_level_id:
        grade = GradeLevel.objects.filter(pk=grade_level_id, school=school).first()

    section = getattr(student, "section", None)
    if year and grade:
        enr = (
            Enrollment.objects.filter(
                student=student,
                academic_year=year,
                grade_level=grade,
            )
            .select_related("section", "section__class_teacher", "section__class_teacher__user")
            .first()
        )
        if enr and enr.section_id:
            section = enr.section

    assessments = Assessment.objects.filter(school=school)
    if year:
        assessments = assessments.filter(academic_year=year)
    if term:
        assessments = assessments.filter(Q(term=term) | Q(term__isnull=True))
    if grade:
        assessments = assessments.filter(grade_level=grade)

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

    # Historical cards: if grade was not passed, use the grade on the marks
    if grade is None and by_subject:
        # Prefer grade from first mark in queryset
        sample = marks[0] if marks else None
        if sample is not None:
            grade = sample.assessment.grade_level
    if grade is None:
        grade = student.current_class

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
                "teacher_name": None,
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
                        "teacher_name": None,
                        "entries": [],
                        "average": None,
                        "grade_letter": None,
                    }
                )

    # Attach subject teachers from SubjectTeacher allocations (grade + year)
    if grade and year and subjects:
        from apps.academics.models import SubjectTeacher

        teacher_by_subject = {}
        st_qs = (
            SubjectTeacher.objects.filter(
                school=school,
                grade_level=grade,
                academic_year=year,
                is_active=True,
            )
            .select_related("teacher", "teacher__user", "subject", "stream")
            .order_by("id")
        )
        student_stream_id = getattr(student, "stream_id", None)
        for st in st_qs:
            sid = str(st.subject_id)
            # Prefer stream-specific assignment when student has a stream
            if sid in teacher_by_subject and st.stream_id and student_stream_id:
                if st.stream_id != student_stream_id:
                    continue
            elif sid in teacher_by_subject and not st.stream_id:
                # Keep existing more-specific assignment if any
                continue
            u = getattr(st.teacher, "user", None)
            if u:
                name = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip()
                name = name or getattr(u, "email", "") or None
            else:
                name = None
            if name:
                # Upgrade to stream match if available
                if student_stream_id and st.stream_id == student_stream_id:
                    teacher_by_subject[sid] = name
                elif sid not in teacher_by_subject:
                    teacher_by_subject[sid] = name
        for s in subjects:
            s["teacher_name"] = teacher_by_subject.get(s["subject_id"])

    overall = float(overall_sum / overall_n) if overall_n else None

    class_teacher_name = None
    if section and getattr(section, "class_teacher", None):
        u = section.class_teacher.user
        class_teacher_name = (
            f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
        )

    gsys = grading_system_for_school(
        school,
        grade.curriculum if grade else None,
    )
    overall_grade = grade_label(overall, gsys, school.passing_mark)
    # Enrich subject rows with readable descriptors
    for s in subjects:
        gl = s.get("grade_letter")
        s["grade_label"] = gl
        s["grade_descriptor"] = grade_descriptor(gl, gsys)

    card = {
        "student": {
            "id": str(student.id),
            "first_name": student.first_name or "",
            "last_name": student.last_name or "",
            "full_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
            "admission_number": student.admission_number or "",
        },
        "school": {
            **_school_print_branding(school),
            "grading_system": gsys,
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
        "overall_grade": overall_grade,
        "overall_grade_descriptor": grade_descriptor(overall_grade, gsys),
        "subjects_with_marks": overall_n,
        "position": None,
        "out_of": None,
    }

    # Class position (skip when nested ranking pass sets _skip_position)
    if not getattr(_build_student_report, "_skip_position", False):
        try:
            _attach_class_position(card, student, school, year, term, grade)
        except Exception:
            pass
    return card


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
            grade_level_id=request.query_params.get("grade_level"),
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

        from apps.academics.models import AcademicYear, GradeLevel, Term
        from .roster import students_for_grade_period

        try:
            grade = GradeLevel.objects.get(pk=grade_id, school=school)
        except GradeLevel.DoesNotExist:
            return Response({"detail": "Invalid grade"}, status=400)

        year_id = request.query_params.get("academic_year")
        term_id = request.query_params.get("term")
        year = AcademicYear.objects.filter(pk=year_id, school=school).first() if year_id else None
        term = Term.objects.filter(pk=term_id, academic_year__school=school).first() if term_id else None
        section_id = request.query_params.get("section")

        students = students_for_grade_period(
            school=school,
            grade=grade,
            academic_year=year,
            term=term,
            section_id=section_id or None,
            include_inactive_statuses=True,
            limit=400,
            sort="name",
        )

        cards = []
        for student in students:
            card = _build_student_report(
                student,
                school,
                academic_year_id=request.query_params.get("academic_year"),
                term_id=request.query_params.get("term"),
                grade_level_id=grade.id,
            )
            cards.append(card)

        # Class ranking by overall average (ties share position)
        ranked = [
            (i, c)
            for i, c in enumerate(cards)
            if c.get("overall_average") is not None
        ]
        ranked.sort(key=lambda x: (-float(x[1]["overall_average"]), x[1]["student"].get("last_name", "")))
        out_of = len(ranked)
        prev_avg = None
        rank = 0
        for pos, (idx, card) in enumerate(ranked, start=1):
            avg = float(card["overall_average"])
            if prev_avg is None or avg != prev_avg:
                rank = pos
            prev_avg = avg
            cards[idx]["position"] = rank
            cards[idx]["out_of"] = out_of
        for c in cards:
            c.setdefault("position", None)
            c.setdefault("out_of", out_of)

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
        from .presets import ensure_term_assessments

        ctx, err = self._resolve_context(request)
        if err:
            return err

        school = ctx["school"]
        assessments = list(self._get_assessments(ctx))

        # Standard plan only: if this subject has no columns yet, create
        # CAT 1–3 + End of Term (+ Practical when relevant). Custom plan UI removed.
        if not assessments:
            ensure_term_assessments(
                school=school,
                academic_year=ctx["year"],
                term=ctx["term"],
                grade_level=ctx["grade"],
                subject=ctx["subject"],
                created_by=request.user if getattr(request.user, "is_authenticated", False) else None,
            )
            assessments = list(self._get_assessments(ctx))

        grade_has_plan = bool(assessments)

        sort = (request.query_params.get("sort") or "name").lower()
        from .roster import students_for_grade_period

        students = students_for_grade_period(
            school=school,
            grade=ctx["grade"],
            academic_year=ctx["year"],
            term=ctx["term"],
            section_id=ctx.get("section_id"),
            include_inactive_statuses=True,
            limit=400,
            sort=sort,
        )
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

        term_locked = bool(getattr(ctx.get("term"), "is_locked", False))
        return Response(
            {
                "academic_year": {"id": ctx["year"].id, "name": ctx["year"].name},
                "term": {
                    "id": ctx["term"].id,
                    "name": ctx["term"].name,
                    "is_locked": term_locked,
                },
                "grade_level": {"id": ctx["grade"].id, "name": ctx["grade"].name},
                "subject": {"id": ctx["subject"].id, "name": ctx["subject"].name},
                "section_id": ctx["section_id"],
                "grading_system": grading_system,
                "passing_mark": passing_mark,
                "columns": columns,
                "grade_has_plan": grade_has_plan,
                "term_locked": term_locked,
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

        term = ctx.get("term")
        if term is not None and getattr(term, "is_locked", False):
            return Response(
                {
                    "detail": "This term is locked. Marks are view-only. Unlock the term under Academics → Years & Terms to edit.",
                },
                status=403,
            )

        school = ctx["school"]
        assessments = list(self._get_assessments(ctx))
        assessment_ids = {str(a.id) for a in assessments}
        by_id = {str(a.id): a for a in assessments}

        payload = request.data.get("marks") or []
        if not isinstance(payload, list):
            return Response({"detail": "marks must be a list"}, status=400)

        if not payload:
            return Response({"saved": 0, "errors": []})

        errors = []
        from .roster import students_for_grade_period

        valid_students = {
            str(s.id)
            for s in students_for_grade_period(
                school=school,
                grade=ctx["grade"],
                academic_year=ctx["year"],
                term=ctx["term"],
                section_id=ctx.get("section_id"),
                include_inactive_statuses=True,
                limit=2000,
            )
        }

        parsed = []
        for row in payload:
            aid = str(row.get("assessment") or "")
            sid = str(row.get("student") or row.get("student_id") or "")
            if aid not in assessment_ids or not sid:
                errors.append({"row": row, "detail": "invalid assessment or student"})
                continue
            if sid not in valid_students:
                errors.append({"row": row, "detail": "student not in class"})
                continue
            assessment = by_id[aid]
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
            parsed.append(
                {
                    "assessment": assessment,
                    "student_id": sid,
                    "score": score,
                    "is_absent": is_absent,
                    "remarks": (row.get("remarks") or "")[:255],
                }
            )

        if not parsed:
            return Response({"saved": 0, "errors": errors[:20]})

        student_ids = list({p["student_id"] for p in parsed})
        existing = {
            (str(m.assessment_id), str(m.student_id)): m
            for m in Mark.objects.filter(
                assessment_id__in=list(assessment_ids),
                student_id__in=student_ids,
            )
        }
        recorder = request.user if getattr(request.user, "is_authenticated", False) else None
        to_create = []
        to_update = []
        with transaction.atomic():
            for p in parsed:
                key = (str(p["assessment"].id), p["student_id"])
                mark = existing.get(key)
                if mark is None:
                    to_create.append(
                        Mark(
                            assessment=p["assessment"],
                            student_id=p["student_id"],
                            school=school,
                            score=p["score"],
                            is_absent=p["is_absent"],
                            remarks=p["remarks"],
                            recorded_by=recorder,
                        )
                    )
                else:
                    mark.score = p["score"]
                    mark.is_absent = p["is_absent"]
                    mark.remarks = p["remarks"]
                    mark.school = school
                    mark.recorded_by = recorder
                    to_update.append(mark)
            if to_create:
                Mark.objects.bulk_create(to_create, batch_size=200)
            if to_update:
                Mark.objects.bulk_update(
                    to_update,
                    ["score", "is_absent", "remarks", "school", "recorded_by", "updated_at"],
                    batch_size=200,
                )

        return Response(
            {
                "saved": len(to_create) + len(to_update),
                "created": len(to_create),
                "updated": len(to_update),
                "errors": errors[:20],
            }
        )


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


class PrepareGradeAssessmentsView(APIView):
    """
    Create the standard assessment plan (CAT 1–3, End of Term, Practical where relevant)
    for every subject mapped to a grade in the given year/term.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.academics.models import AcademicYear, Term, GradeLevel, GradeLevelSubject
        from .presets import ensure_term_assessments

        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)

        year_id = request.data.get("academic_year")
        term_id = request.data.get("term")
        grade_id = request.data.get("grade_level")
        if not year_id or not term_id or not grade_id:
            return Response(
                {"detail": "academic_year, term and grade_level are required"},
                status=400,
            )

        year = AcademicYear.objects.filter(pk=year_id, school=school).first()
        term = Term.objects.filter(pk=term_id, academic_year=year).first() if year else None
        grade = GradeLevel.objects.filter(pk=grade_id).first()
        if not year or not term or not grade:
            return Response({"detail": "Invalid year, term or grade"}, status=400)

        mapped = (
            GradeLevelSubject.objects.filter(grade_level=grade)
            .select_related("subject")
            .order_by("order", "subject__name")
        )
        created_total = 0
        subjects_done = []
        skipped_custom = 0
        for row in mapped:
            before_qs = Assessment.objects.filter(
                school=school,
                academic_year=year,
                term=term,
                grade_level=grade,
                subject=row.subject,
            )
            before = before_qs.count()
            # Skip subjects that already have a custom plan — do not overlay standard
            from .presets import assessment_names_look_standard
            if before:
                names = set(before_qs.values_list("name", flat=True))
                if not assessment_names_look_standard(names):
                    skipped_custom += 1
                    subjects_done.append(
                        {
                            "subject_id": str(row.subject_id),
                            "subject_name": row.subject.name,
                            "created": 0,
                            "columns": before,
                            "skipped": "custom_plan",
                        }
                    )
                    continue
            ensure_term_assessments(
                school=school,
                academic_year=year,
                term=term,
                grade_level=grade,
                subject=row.subject,
                created_by=request.user if request.user.is_authenticated else None,
            )
            after = Assessment.objects.filter(
                school=school,
                academic_year=year,
                term=term,
                grade_level=grade,
                subject=row.subject,
            ).count()
            created = max(0, after - before)
            created_total += created
            subjects_done.append(
                {
                    "subject_id": str(row.subject_id),
                    "subject_name": row.subject.name,
                    "created": created,
                    "columns": after,
                }
            )

        return Response(
            {
                "subjects": len(subjects_done),
                "assessments_created": created_total,
                "skipped_custom": skipped_custom,
                "detail": subjects_done,
            },
            status=status.HTTP_201_CREATED if created_total else status.HTTP_200_OK,
        )


class MarksCsvImportView(APIView):
    """
    Bulk marks via CSV for one class + subject + term markbook.

    GET  ?academic_year=&term=&grade_level=&subject=&section=
         → download template with admission numbers and assessment columns

    POST same filters + multipart file field "file" (or body text "csv")
         CSV header: admission_number, <assessment name>, <assessment name>, ...
         Optional columns: name (ignored), student_id
         Empty cells are skipped; "A" or "ABS" marks absent.
    """

    permission_classes = [IsAuthenticated]

    def _context(self, request):
        matrix = MarksMatrixView()
        return matrix._resolve_context(request)

    def _assessments(self, ctx):
        from .presets import ensure_term_assessments

        qs = Assessment.objects.filter(
            school=ctx["school"],
            academic_year=ctx["year"],
            term=ctx["term"],
            grade_level=ctx["grade"],
            subject=ctx["subject"],
        )
        if not qs.exists():
            ensure_term_assessments(
                school=ctx["school"],
                academic_year=ctx["year"],
                term=ctx["term"],
                grade_level=ctx["grade"],
                subject=ctx["subject"],
                created_by=None,
            )
            qs = Assessment.objects.filter(
                school=ctx["school"],
                academic_year=ctx["year"],
                term=ctx["term"],
                grade_level=ctx["grade"],
                subject=ctx["subject"],
            )
        return list(qs.order_by("name"))

    def _students(self, ctx):
        from apps.students.models import Student

        qs = (
            Student.objects.filter(school=ctx["school"], current_class=ctx["grade"])
            .exclude(status__in=["TRANSFERRED", "WITHDRAWN", "GRADUATED", "PENDING_CLEARANCE"])
            .order_by("admission_number", "last_name", "first_name")
        )
        if ctx.get("section_id"):
            qs = qs.filter(section_id=ctx["section_id"])
        return list(qs[:500])

    def get(self, request):
        from django.http import HttpResponse

        ctx, err = self._context(request)
        if err:
            return err
        assessments = self._assessments(ctx)
        students = self._students(ctx)
        headers = ["admission_number", "name"] + [a.name for a in assessments]
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        for s in students:
            name = f"{s.first_name or ''} {s.last_name or ''}".strip()
            writer.writerow([s.admission_number or "", name] + [""] * len(assessments))
        filename = (
            f"marks_{ctx['grade'].name}_{ctx['subject'].name}_{ctx['term'].name}.csv"
            .replace(" ", "_")
        )
        resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    def post(self, request):
        from decimal import Decimal, InvalidOperation
        from apps.students.models import Student

        ctx, err = self._context(request)
        if err:
            return err

        assessments = self._assessments(ctx)
        by_name = {a.name.strip().lower(): a for a in assessments}

        raw = None
        upload = request.FILES.get("file")
        if upload:
            raw = upload.read().decode("utf-8-sig", errors="replace")
        elif isinstance(request.data.get("csv"), str):
            raw = request.data.get("csv")
        if not raw or not raw.strip():
            return Response(
                {"detail": "Upload a CSV file (field name: file) or send csv text."},
                status=400,
            )

        reader = csv.DictReader(io.StringIO(raw))
        if not reader.fieldnames:
            return Response({"detail": "CSV has no header row"}, status=400)

        field_map = {}
        skip_fields = {
            "admission_number",
            "admission",
            "adm",
            "adm_no",
            "adm_number",
            "name",
            "student",
            "student_name",
            "student_id",
            "id",
        }
        for h in reader.fieldnames:
            key = (h or "").strip()
            if not key:
                continue
            low = key.lower().replace(" ", "_")
            if low in skip_fields or low in (
                "admission_number",
                "admission",
                "adm_no",
            ):
                continue
            assessment = by_name.get(key.lower()) or by_name.get(key.strip().lower())
            if assessment:
                field_map[key] = assessment

        if not field_map:
            return Response(
                {
                    "detail": "No assessment columns matched. Use assessment names as headers "
                    f"(e.g. {', '.join(a.name for a in assessments)})."
                },
                status=400,
            )

        # Index students by admission number (case-insensitive)
        students = self._students(ctx)
        by_adm = {}
        for s in students:
            adm = (s.admission_number or "").strip().upper()
            if adm:
                by_adm[adm] = s

        saved = 0
        skipped = 0
        errors = []
        for i, row in enumerate(reader, start=2):
            adm = (
                row.get("admission_number")
                or row.get("Admission Number")
                or row.get("admission")
                or row.get("adm")
                or row.get("Adm")
                or row.get("ADM")
                or ""
            ).strip().upper()
            if not adm:
                # try first column
                for k, v in row.items():
                    if k and "adm" in k.lower() and v:
                        adm = str(v).strip().upper()
                        break
            if not adm:
                errors.append({"row": i, "detail": "missing admission_number"})
                continue
            student = by_adm.get(adm)
            if not student:
                errors.append({"row": i, "admission_number": adm, "detail": "student not found in class"})
                continue

            for header, assessment in field_map.items():
                cell = row.get(header)
                if cell is None:
                    continue
                text = str(cell).strip()
                if text == "":
                    skipped += 1
                    continue
                is_absent = text.upper() in ("A", "ABS", "ABSENT", "-")
                score = None
                if not is_absent:
                    try:
                        score = Decimal(text.replace(",", ""))
                    except (InvalidOperation, ValueError):
                        errors.append(
                            {
                                "row": i,
                                "admission_number": adm,
                                "assessment": assessment.name,
                                "detail": f"invalid score '{text}'",
                            }
                        )
                        continue
                    if score < 0 or score > assessment.max_score:
                        errors.append(
                            {
                                "row": i,
                                "admission_number": adm,
                                "assessment": assessment.name,
                                "detail": f"score must be 0–{assessment.max_score}",
                            }
                        )
                        continue
                Mark.objects.update_or_create(
                    assessment=assessment,
                    student=student,
                    defaults={
                        "school": ctx["school"],
                        "score": score,
                        "is_absent": is_absent,
                        "recorded_by": request.user
                        if request.user.is_authenticated
                        else None,
                    },
                )
                saved += 1

        return Response(
            {
                "saved": saved,
                "skipped_empty": skipped,
                "errors": errors[:50],
                "error_count": len(errors),
                "assessments_matched": [a.name for a in field_map.values()],
            }
        )



class TranscriptView(APIView):
    """
    Official multi-term academic transcript for one student.
    Aggregates all published-style term averages across years.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        student_id = request.query_params.get("student")
        if not student_id:
            return Response({"detail": "student is required"}, status=400)
        from apps.students.models import Student
        from apps.academics.models import AcademicYear, Term

        student = (
            Student.objects.filter(pk=student_id, school=school)
            .select_related("current_class", "section", "school")
            .first()
        )
        if not student:
            return Response({"detail": "Student not found"}, status=404)

        years = AcademicYear.objects.filter(school=school).order_by("start_date", "name")
        terms_payload = []
        all_averages = []
        for year in years:
            for term in year.terms.order_by("order", "name"):
                card = _build_student_report(
                    student, school, academic_year_id=year.id, term_id=term.id
                )
                if not card.get("subjects_with_marks") and not any(
                    s.get("average") is not None for s in card.get("subjects") or []
                ):
                    continue
                terms_payload.append(
                    {
                        "academic_year": {"id": year.id, "name": year.name},
                        "term": {"id": term.id, "name": term.name},
                        "subjects": card.get("subjects") or [],
                        "overall_average": card.get("overall_average"),
                        "overall_grade": card.get("overall_grade"),
                        "position": card.get("position"),
                        "class_teacher_name": card.get("class_teacher_name"),
                    }
                )
                if card.get("overall_average") is not None:
                    all_averages.append(float(card["overall_average"]))

        cumulative = (
            round(sum(all_averages) / len(all_averages), 1) if all_averages else None
        )
        from .grading import grade_label, grading_system_for_school

        return Response(
            {
                "document": "OFFICIAL ACADEMIC TRANSCRIPT",
                "issued_at": __import__("django.utils.timezone", fromlist=["now"]).now().date().isoformat(),
                "school": _school_print_branding(school, request),
                "student": {
                    "id": str(student.id),
                    "admission_number": student.admission_number,
                    "full_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
                    "date_of_birth": student.date_of_birth.isoformat()
                    if student.date_of_birth
                    else None,
                    "gender": student.gender,
                    "nationality": student.nationality,
                    "current_grade": student.current_class.name if student.current_class else None,
                },
                "terms": terms_payload,
                "cumulative_average": cumulative,
                "cumulative_grade": grade_label(
                    cumulative,
                    grading_system_for_school(
                        school,
                        student.current_class.curriculum if student.current_class else None,
                    ),
                    school.passing_mark,
                )
                if cumulative is not None
                else None,
                "certification": (
                    "This is to certify that the above is a true extract of the academic record "
                    "of the named learner as held by the school."
                ),
            }
        )



class LearnerProgressView(APIView):
    """
    Full academic progress for one learner: every year/term subject averages,
    for growth analysis from joining to date.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        student_id = request.query_params.get("student")
        if not student_id:
            return Response({"detail": "student is required"}, status=400)

        from apps.students.models import Student
        from .grading import grade_label, grading_system_for_school
        from .models import Mark

        try:
            student = Student.objects.select_related(
                "current_class", "current_class__curriculum"
            ).get(pk=student_id, school=school)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=404)

        marks = (
            Mark.objects.filter(student=student, school=school)
            .select_related(
                "assessment",
                "assessment__subject",
                "assessment__academic_year",
                "assessment__term",
                "assessment__grade_level",
            )
            .order_by(
                "assessment__academic_year__start_date",
                "assessment__term__order",
                "assessment__subject__name",
            )
        )

        # period_key -> subject_key -> weighted accumulators
        periods = {}
        for m in marks:
            a = m.assessment
            pct = m.percentage
            if pct is None:
                continue
            year = a.academic_year
            term = a.term
            pk = (
                year.id if year else 0,
                term.id if term else 0,
            )
            period = periods.setdefault(
                pk,
                {
                    "academic_year": {
                        "id": year.id if year else None,
                        "name": year.name if year else "—",
                    },
                    "term": {
                        "id": term.id if term else None,
                        "name": term.name if term else "—",
                        "is_locked": bool(getattr(term, "is_locked", False)) if term else False,
                    },
                    "grade_level": {
                        "id": a.grade_level_id,
                        "name": getattr(a.grade_level, "name", None) or "—",
                    },
                    "subjects": {},
                },
            )
            sk = str(a.subject_id)
            bucket = period["subjects"].setdefault(
                sk,
                {
                    "subject_id": sk,
                    "subject_name": a.subject.name if a.subject_id else "—",
                    "weighted_sum": Decimal("0"),
                    "weight_total": Decimal("0"),
                    "entries": [],
                },
            )
            w = Decimal(str(a.weight or 1))
            bucket["weighted_sum"] += Decimal(str(pct)) * w
            bucket["weight_total"] += w
            bucket["entries"].append(
                {
                    "assessment": a.name,
                    "percentage": float(pct),
                    "score": float(m.score) if m.score is not None else None,
                }
            )

        curriculum = getattr(getattr(student, "current_class", None), "curriculum", None)
        grading_system = grading_system_for_school(school, curriculum)
        passing = int(getattr(school, "passing_mark", None) or 50)

        series = []
        subject_trends = {}  # subject_name -> list of {period, average}

        for pk in sorted(periods.keys(), key=lambda x: (x[0], x[1])):
            period = periods[pk]
            subject_rows = []
            overall_sum = Decimal("0")
            overall_n = 0
            for b in sorted(period["subjects"].values(), key=lambda x: x["subject_name"]):
                avg = None
                if b["weight_total"] > 0:
                    avg = float(b["weighted_sum"] / b["weight_total"])
                    overall_sum += Decimal(str(avg))
                    overall_n += 1
                avg_r = round(avg, 1) if avg is not None else None
                subject_rows.append(
                    {
                        "subject_id": b["subject_id"],
                        "subject_name": b["subject_name"],
                        "average": avg_r,
                        "grade_letter": grade_label(avg, grading_system, passing) if avg is not None else None,
                        "entries": b["entries"],
                    }
                )
                if avg_r is not None:
                    subject_trends.setdefault(b["subject_name"], []).append(
                        {
                            "academic_year": period["academic_year"]["name"],
                            "term": period["term"]["name"],
                            "grade": period["grade_level"]["name"],
                            "average": avg_r,
                        }
                    )
            overall = float(overall_sum / overall_n) if overall_n else None
            series.append(
                {
                    "academic_year": period["academic_year"],
                    "term": period["term"],
                    "grade_level": period["grade_level"],
                    "subjects": subject_rows,
                    "overall_average": round(overall, 1) if overall is not None else None,
                    "overall_grade": grade_label(overall, grading_system, passing)
                    if overall is not None
                    else None,
                }
            )

        return Response(
            {
                "student": {
                    "id": str(student.id),
                    "admission_number": student.admission_number or "",
                    "name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
                    "current_class": getattr(student.current_class, "name", None),
                },
                "periods": series,
                "subject_trends": [
                    {"subject_name": k, "points": v}
                    for k, v in sorted(subject_trends.items(), key=lambda x: x[0])
                ],
            }
        )


class ExamHallViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        from .models import ExamHall

        school = selected_school(self.request)
        if not school:
            return ExamHall.objects.none()
        return ExamHall.objects.filter(school=school)

    def get_serializer_class(self):
        from rest_framework import serializers
        from .models import ExamHall

        class S(serializers.ModelSerializer):
            class Meta:
                model = ExamHall
                fields = "__all__"
                read_only_fields = ("id", "school", "created_at")

        return S

    def perform_create(self, serializer):
        school = selected_school(self.request)
        serializer.save(school=school)


class ExamSittingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        from .models import ExamSitting

        school = selected_school(self.request)
        if not school:
            return ExamSitting.objects.none()
        qs = ExamSitting.objects.filter(school=school).select_related(
            "hall", "grade_level", "subject", "academic_year", "term"
        )
        grade = self.request.query_params.get("grade_level")
        if grade:
            qs = qs.filter(grade_level_id=grade)
        return qs.order_by("-exam_date", "start_time")

    def get_serializer_class(self):
        from rest_framework import serializers
        from .models import ExamSitting, ExamSeat

        class S(serializers.ModelSerializer):
            hall_name = serializers.CharField(source="hall.name", read_only=True)
            subject_name = serializers.CharField(source="subject.name", read_only=True)
            grade_name = serializers.CharField(source="grade_level.name", read_only=True)
            seat_count = serializers.SerializerMethodField()

            class Meta:
                model = ExamSitting
                fields = (
                    "id",
                    "title",
                    "assessment",
                    "academic_year",
                    "term",
                    "grade_level",
                    "subject",
                    "hall",
                    "hall_name",
                    "exam_date",
                    "start_time",
                    "end_time",
                    "instructions",
                    "subject_name",
                    "grade_name",
                    "seat_count",
                    "created_at",
                )
                read_only_fields = ("id", "created_at")

            def get_seat_count(self, obj):
                return obj.seats.count()

        return S

    def perform_create(self, serializer):
        school = selected_school(self.request)
        serializer.save(
            school=school,
            created_by=self.request.user if self.request.user.is_authenticated else None,
        )


class ExamAllocateSeatsView(APIView):
    """Auto-assign seats for all learners in the sitting's grade (optional section)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, sitting_id):
        from .models import ExamSitting, ExamSeat
        from apps.students.models import Student

        school = selected_school(request)
        sitting = ExamSitting.objects.filter(pk=sitting_id, school=school).select_related("hall").first()
        if not sitting:
            return Response({"detail": "Sitting not found"}, status=404)

        qs = (
            Student.objects.filter(school=school, current_class=sitting.grade_level)
            .exclude(status__in=["TRANSFERRED", "WITHDRAWN", "GRADUATED", "PENDING_CLEARANCE"])
            .order_by("admission_number", "last_name")
        )
        section_id = request.data.get("section")
        if section_id:
            qs = qs.filter(section_id=section_id)
        students = list(qs[: sitting.hall.capacity])
        ExamSeat.objects.filter(sitting=sitting).delete()
        seats = []
        for i, st in enumerate(students, start=1):
            row = chr(64 + ((i - 1) // 10) + 1)  # A, B, C...
            num = ((i - 1) % 10) + 1
            label = f"{row}-{num}"
            seats.append(
                ExamSeat(sitting=sitting, student=st, seat_label=label, row_label=row)
            )
        ExamSeat.objects.bulk_create(seats)
        return Response(
            {
                "allocated": len(seats),
                "capacity": sitting.hall.capacity,
                "hall": sitting.hall.name,
            }
        )


class ExamSeatListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sitting_id):
        from .models import ExamSitting, ExamSeat

        school = selected_school(request)
        sitting = ExamSitting.objects.filter(pk=sitting_id, school=school).first()
        if not sitting:
            return Response({"detail": "Sitting not found"}, status=404)
        seats = (
            ExamSeat.objects.filter(sitting=sitting)
            .select_related("student")
            .order_by("seat_label")
        )
        return Response(
            {
                "sitting_id": str(sitting.id),
                "title": sitting.title,
                "seats": [
                    {
                        "seat_label": s.seat_label,
                        "row_label": s.row_label,
                        "admission_number": s.student.admission_number,
                        "name": f"{s.student.first_name or ''} {s.student.last_name or ''}".strip(),
                        "student_id": str(s.student_id),
                    }
                    for s in seats
                ],
            }
        )
