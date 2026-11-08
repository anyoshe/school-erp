import uuid
from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from apps.school.models import School


class Assessment(models.Model):
    class Kind(models.TextChoices):
        CAT = "CAT", "CAT / Continuous"
        MIDTERM = "MIDTERM", "Midterm"
        END_TERM = "END_TERM", "End of term"
        PRACTICAL = "PRACTICAL", "Practical"
        PROJECT = "PROJECT", "Project"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="assessments")
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.CAT)

    academic_year = models.ForeignKey(
        "academics.AcademicYear",
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    term = models.ForeignKey(
        "academics.Term",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments",
    )
    grade_level = models.ForeignKey(
        "academics.GradeLevel",
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments",
    )

    max_score = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=Decimal("100"),
        validators=[MinValueValidator(Decimal("1"))],
    )
    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("1"),
        help_text="Relative weight for future term totals",
        validators=[MinValueValidator(Decimal("0"))],
    )
    assessment_date = models.DateField(null=True, blank=True)
    is_published = models.BooleanField(default=False)
    notes = models.CharField(max_length=255, blank=True)

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-assessment_date", "-created_at"]
        indexes = [
            models.Index(fields=["school", "academic_year", "grade_level"]),
            models.Index(fields=["school", "subject"]),
        ]

    def __str__(self):
        return f"{self.name} · {self.grade_level_id} · {self.subject_id}"


class Mark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="marks")
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="marks")
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="marks",
    )
    score = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    is_absent = models.BooleanField(default=False)
    remarks = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marks_recorded",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("assessment", "student")
        ordering = ["student__last_name", "student__first_name"]

    @property
    def percentage(self):
        if self.score is None or self.is_absent:
            return None
        max_s = self.assessment.max_score or Decimal("100")
        if max_s <= 0:
            return None
        return (self.score / max_s) * Decimal("100")

    @property
    def grade_letter(self):
        pct = self.percentage
        if pct is None:
            return None
        p = float(pct)
        if p >= 80:
            return "A"
        if p >= 70:
            return "B"
        if p >= 60:
            return "C"
        if p >= 50:
            return "D"
        return "E"

    def __str__(self):
        return f"{self.student_id} {self.assessment_id} {self.score}"
