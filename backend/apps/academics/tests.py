from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from .models import AcademicYear, GradeLevel, GradeLevelSubject, SubjectTeacher
from .views import SubjectTeacherViewSet


class SubjectTeacherCoverageTests(SimpleTestCase):
    def test_coverage_returns_grade_subjects_without_active_filter(self):
        grade = SimpleNamespace(id=225, name="Grade 4")
        mapped_subject = SimpleNamespace(
            subject_id=12,
            subject=SimpleNamespace(name="Mathematics"),
            is_compulsory=True,
        )
        mapped_queryset = Mock()
        mapped_queryset.select_related.return_value.order_by.return_value = [mapped_subject]
        assignments_queryset = Mock()
        assignments_queryset.select_related.return_value = []
        request = Request(
            APIRequestFactory().get(
                "/api/academics/subject-teachers/coverage/",
                {"grade_level": "225", "academic_year": "1"},
            )
        )

        with (
            patch("apps.academics.views.selected_school", return_value=SimpleNamespace(id=1)),
            patch.object(GradeLevel.objects, "filter") as grade_filter,
            patch.object(AcademicYear.objects, "filter") as year_filter,
            patch.object(GradeLevelSubject.objects, "filter", return_value=mapped_queryset) as mapped_filter,
            patch.object(SubjectTeacher.objects, "filter", return_value=assignments_queryset),
        ):
            grade_filter.return_value.first.return_value = grade
            year_filter.return_value.first.return_value = None

            response = SubjectTeacherViewSet().coverage(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_subjects"], 1)
        self.assertEqual(response.data["rows"][0]["subject_name"], "Mathematics")
        mapped_filter.assert_called_once_with(grade_level=grade)
