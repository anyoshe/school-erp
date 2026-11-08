from unittest import TestCase

from .grading import grade_label, grading_system_for_school


class GradeLabelTests(TestCase):
    def test_kjsea_levels_cover_reported_mark_ranges(self):
        cases = [
            (100, "EE1"),
            (90, "EE1"),
            (89, "EE2"),
            (75, "EE2"),
            (74, "ME1"),
            (58, "ME1"),
            (57, "ME2"),
            (41, "ME2"),
            (40, "AE1"),
            (31, "AE1"),
            (30, "AE2"),
            (21, "AE2"),
            (20, "BE1"),
            (11, "BE1"),
            (10, "BE2"),
            (0, "BE2"),
        ]

        for percentage, expected in cases:
            with self.subTest(percentage=percentage):
                self.assertEqual(grade_label(percentage, "cbc"), expected)

    def test_non_cbc_scales_keep_existing_letter_grades(self):
        for system in ("percentage", "points", "letter", "kenya_844"):
            with self.subTest(system=system):
                self.assertEqual(grade_label(80, system), "A")
                self.assertEqual(grade_label(70, system), "B")
                self.assertEqual(grade_label(60, system), "C")
                self.assertEqual(grade_label(50, system), "D")
                self.assertEqual(grade_label(49, system), "E")

    def test_other_supported_scale_behaviors_are_preserved(self):
        self.assertEqual(grade_label(79, "mastery"), "Approaching mastery")
        self.assertEqual(grade_label(50, "pass_fail", 50), "Pass")
        self.assertEqual(grade_label(49, "pass_fail", 50), "Fail")
        self.assertIsNone(grade_label(None, "cbc"))

    def test_cbc_curriculum_overrides_default_percentage_setting(self):
        school = type("School", (), {"grading_system": "percentage"})()
        curriculum = type(
            "Curriculum",
            (),
            {"short_code": "KE-CBC", "name": "Kenya Competency Based Curriculum"},
        )()

        self.assertEqual(grading_system_for_school(school, curriculum), "cbc")

    def test_explicit_non_default_scale_and_non_cbc_curriculum_are_preserved(self):
        school = type("School", (), {"grading_system": "pass_fail"})()
        cbc = type("Curriculum", (), {"short_code": "KE-CBC", "name": "Kenya CBC"})()
        legacy = type("Curriculum", (), {"short_code": "KE-844", "name": "Kenya 8-4-4"})()

        self.assertEqual(grading_system_for_school(school, cbc), "pass_fail")
        self.assertEqual(grading_system_for_school(school, legacy), "pass_fail")
