from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import accessible_school_ids, selected_school
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
                for m in Mark.objects.filter(assessment=assessment).select_related("student")
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
            .select_related("assessment", "student", "assessment__subject")
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
