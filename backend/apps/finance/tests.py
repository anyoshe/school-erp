from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from .clearance import find_fee_structure


class FindFeeStructureTests(SimpleTestCase):
    def setUp(self):
        self.grade = SimpleNamespace(id=10)
        self.student = SimpleNamespace(
            school_id=1,
            current_class=self.grade,
        )

    def make_structure(self, *, grade_id=10, year="2026", term="Term 3", active=True):
        return SimpleNamespace(
            id=f"{grade_id}-{year}-{term}",
            school_id=1,
            grade_level_id=grade_id,
            academic_year=year,
            period_name=term,
            is_active=active,
        )

    def resolve(self, structures, year="2026", term="Term 3"):
        queryset = Mock()
        queryset.prefetch_related.return_value = structures
        with patch("apps.finance.models.FeeStructure.objects.filter", return_value=queryset):
            return find_fee_structure(
                self.student,
                academic_year=year,
                period_name=term,
            )

    def test_selects_only_the_exact_grade_year_and_term(self):
        wrong_year = self.make_structure(year="2027", term="Term 1")
        wrong_term = self.make_structure(term="Term 1")
        expected = self.make_structure()

        self.assertIs(self.resolve([wrong_year, wrong_term, expected]), expected)

    def test_does_not_fall_back_to_another_period_grade_or_inactive_structure(self):
        alternatives = [
            self.make_structure(year="2027", term="Term 1"),
            self.make_structure(term="Term 1"),
            self.make_structure(grade_id=11),
            self.make_structure(active=False),
        ]

        self.assertIsNone(self.resolve(alternatives))

    def test_requires_an_explicit_year_and_term(self):
        self.assertIsNone(self.resolve([self.make_structure()], year="", term=""))
