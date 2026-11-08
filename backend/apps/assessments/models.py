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
        from .grading import grade_label, grading_system_for_school

        return grade_label(
            pct,
            grading_system_for_school(
                self.school,
                self.assessment.grade_level.curriculum,
            ),
            self.school.passing_mark,
        )

    def __str__(self):
        return f"{self.student_id} {self.assessment_id} {self.score}"


class ExamHall(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="exam_halls")
    name = models.CharField(max_length=120)
    building = models.CharField(max_length=120, blank=True)
    capacity = models.PositiveIntegerField(default=30)
    notes = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("school", "name")

    def __str__(self):
        return f"{self.name} ({self.capacity})"


class ExamSitting(models.Model):
    """A scheduled exam session in a hall (ministry-style room allocation)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="exam_sittings")
    title = models.CharField(max_length=200)
    assessment = models.ForeignKey(
        Assessment, on_delete=models.SET_NULL, null=True, blank=True, related_name="sittings"
    )
    academic_year = models.ForeignKey(
        "academics.AcademicYear", on_delete=models.CASCADE, related_name="exam_sittings"
    )
    term = models.ForeignKey(
        "academics.Term", on_delete=models.SET_NULL, null=True, blank=True, related_name="exam_sittings"
    )
    grade_level = models.ForeignKey(
        "academics.GradeLevel", on_delete=models.CASCADE, related_name="exam_sittings"
    )
    subject = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE, related_name="exam_sittings"
    )
    hall = models.ForeignKey(ExamHall, on_delete=models.PROTECT, related_name="sittings")
    exam_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    instructions = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="exam_sittings_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["exam_date", "start_time"]

    def __str__(self):
        return f"{self.title} @ {self.hall.name}"


class ExamSeat(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sitting = models.ForeignKey(ExamSitting, on_delete=models.CASCADE, related_name="seats")
    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="exam_seats"
    )
    seat_label = models.CharField(max_length=20)  # e.g. A-12
    row_label = models.CharField(max_length=10, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("sitting", "student"), ("sitting", "seat_label"))
        ordering = ["seat_label"]

    def __str__(self):
        return f"{self.seat_label} → {self.student_id}"
