# academics/models.py
from django.db import models
from apps.school.models import School


class Curriculum(models.Model):
    """
    Different academic systems a school might run (can have multiple)
    Examples: CBC, 8-4-4, IGCSE, Cambridge, IB, etc.
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="curricula")
    name = models.CharField(max_length=120)  # "CBC", "8-4-4", "Cambridge IGCSE"
    short_code = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    # Optional overrides of school defaults
    term_system = models.CharField(max_length=20, blank=True, null=True)
    number_of_terms = models.PositiveIntegerField(null=True, blank=True)
    grading_system = models.CharField(max_length=20, blank=True, null=True)
    passing_mark = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        unique_together = ["school", "name"]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.school})"


class GradeLevel(models.Model):
    """
    Classes / Forms / Years / Grades
    Example: PP1, Grade 4, Form 2, Year 9
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="grade_levels")
    curriculum = models.ForeignKey(
        Curriculum, on_delete=models.CASCADE, related_name="grade_levels", null=True, blank=True
    )
    name = models.CharField(max_length=80)          # "Grade 4", "Form 2", "Year 9"
    short_name = models.CharField(max_length=30, blank=True)
    order = models.PositiveIntegerField(default=0)  # for sorting
    code = models.CharField(max_length=20, blank=True)  # optional internal code

    class Meta:
        ordering = ["order", "name"]
        unique_together = ["school", "name"]

    def __str__(self):
        return self.name


class Department(models.Model):
    """
    Streams / Departments / Faculties
    Example: Science, Humanities, Technical, Commercial
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="departments")
    curriculum = models.ForeignKey(
        Curriculum, on_delete=models.SET_NULL, null=True, blank=True, related_name="departments"
    )
    name = models.CharField(max_length=120)
    short_name = models.CharField(max_length=50, blank=True)
    code = models.CharField(max_length=20, blank=True)

    class Meta:
        unique_together = ["school", "name"]
        ordering = ["name"]

    def __str__(self):
        return self.name