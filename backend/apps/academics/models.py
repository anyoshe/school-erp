# apps/academics/models.py

from django.db import models
from django.core.exceptions import ValidationError
from apps.school.models import School


# =========================================================
# CURRICULUM
# =========================================================

class Curriculum(models.Model):
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="curricula",
        null=True,
        blank=True,
        help_text="Null for global templates"
    )

    name = models.CharField(max_length=120)

    short_code = models.CharField(
        max_length=20,
        blank=True
    )

    description = models.TextField(blank=True)

    is_active = models.BooleanField(
        default=True
    )

    is_template = models.BooleanField(
        default=False,
        help_text="True if global template"
    )

    # Optional overrides
    term_system = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )

    number_of_terms = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    grading_system = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )

    passing_mark = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    class Meta:
        ordering = ["-is_template", "name"]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    models.Q(school__isnull=True, is_template=True) |
                    models.Q(school__isnull=False, is_template=False)
                ),
                name="curriculum_template_school_consistency",
            ),
            models.UniqueConstraint(
                fields=['school', 'name'],
                condition=models.Q(school__isnull=False),
                name="curriculum_unique_name_per_school"
            ),
            models.UniqueConstraint(
                fields=['name'],
                condition=models.Q(school__isnull=True, is_template=True),
                name="curriculum_unique_template_name"
            ),
        ]

    def clean(self):

        if self.is_template and self.school is not None:
            raise ValidationError(
                "Templates must have school = null"
            )

        if not self.is_template and self.school is None:
            raise ValidationError(
                "School-specific curricula must have a school"
            )

    def __str__(self):

        if self.is_template:
            return f"[Template] {self.name}"

        return f"{self.name} ({self.school})"



# =========================================================
# GRADE LEVEL
# =========================================================

class GradeLevel(models.Model):

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="grade_levels",
        null=True,  
        blank=True
    )

    curriculum = models.ForeignKey(
        Curriculum,
        on_delete=models.CASCADE,
        related_name="grade_levels"
    )

    name = models.CharField(
        max_length=80
    )

    short_name = models.CharField(
        max_length=30,
        blank=True
    )

    order = models.PositiveIntegerField(
        default=0
    )

    code = models.CharField(
        max_length=20,
        blank=True
    )


    EDUCATION_LEVEL_CHOICES = [

        ('PRE_PRIMARY', 'Pre-Primary'),

        ('PRIMARY', 'Primary'),

        ('JUNIOR', 'Junior Secondary'),

        ('SENIOR', 'Senior Secondary'),

        ('TERTIARY', 'College / University'),

        ('OTHER', 'Other'),

    ]

    education_level = models.CharField(
        max_length=20,
        choices=EDUCATION_LEVEL_CHOICES,
        default='PRIMARY'
    )

    class Meta:

        ordering = ["order"]

        unique_together = (
            "school",
            "name"
        )

    def __str__(self):

        return self.name



# =========================================================
# STREAM
# =========================================================

class Stream(models.Model):

    grade_level = models.ForeignKey(
        GradeLevel,
        on_delete=models.CASCADE,
        related_name="streams"
    )

    name = models.CharField(
        max_length=100
    )

    description = models.TextField(
        blank=True
    )

    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum students allowed"
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:

        unique_together = (
            "grade_level",
            "name"
        )

        ordering = ["name"]

    def __str__(self):

        return f"{self.grade_level.name} - {self.name}"



# =========================================================
# SECTION
# =========================================================

class Section(models.Model):

    grade_level = models.ForeignKey(
        GradeLevel,
        on_delete=models.CASCADE,
        related_name="sections"
    )

    name = models.CharField(
        max_length=100
    )

    description = models.TextField(
        blank=True
    )
    capacity = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:

        unique_together = (
            "grade_level",
            "name"
        )

        ordering = ["name"]

    def __str__(self):

        return f"{self.grade_level.name} - {self.name}"



# =========================================================
# PATHWAY (Senior Secondary / University)
# =========================================================

class Pathway(models.Model):

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="pathways",
        null=True,
        blank=True
    )

    name = models.CharField(
        max_length=50
    )

    short_code = models.CharField(
        max_length=20,
        blank=True
    )

    description = models.TextField(
        blank=True
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:

        unique_together = (
            "school",
            "name"
        )

    def __str__(self):

        return self.name



# =========================================================
# TRACK (Inside Pathway)
# =========================================================

class Track(models.Model):

    pathway = models.ForeignKey(
        Pathway,
        on_delete=models.CASCADE,
        related_name="tracks"
    )

    name = models.CharField(
        max_length=100
    )

    description = models.TextField(
        blank=True
    )

    is_active = models.BooleanField(
        default=True
    )

    def __str__(self):

        return f"{self.pathway.name} - {self.name}"



# =========================================================
# DEPARTMENT
# =========================================================
class Department(models.Model):

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="departments",
        null=True,
        blank=True
    )

    curriculum = models.ForeignKey(
        Curriculum,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="departments"
    )

    # NEW (optional linkage)
    pathway = models.ForeignKey(
        'Pathway',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="departments"
    )

    track = models.ForeignKey(
        'Track',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="departments"
    )

    name = models.CharField(
        max_length=120
    )

    short_name = models.CharField(
        max_length=50,
        blank=True
    )

    code = models.CharField(
        max_length=20,
        blank=True
    )

    is_academic = models.BooleanField(
        default=True,
        help_text="False for admin departments (Finance, HR, etc.)"
    )

    class Meta:

        ordering = ["name"]

        unique_together = (
            "school",
            "name"
        )

    def __str__(self):

        return self.name

# =========================================================
# SUBJECT GROUP (Optional but Powerful)
# =========================================================

class SubjectGroup(models.Model):
    """
    Used to group subjects logically.

    Examples:
        Languages
        Sciences
        Humanities
        Electives
    """

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="subject_groups",
        null=True,
        blank=True
    )

    name = models.CharField(
        max_length=100
    )

    description = models.TextField(
        blank=True
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:

        ordering = ["name"]

        unique_together = (
            "school",
            "name"
        )

    def __str__(self):

        return self.name



# =========================================================
# SUBJECT
# =========================================================

class Subject(models.Model):
    """
    Master subject list.

    Subjects belong to departments.
    Can be reused across multiple grade levels.
    """

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="subjects",
        null=True,
        blank=True
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subjects"
    )

    subject_group = models.ForeignKey(
        SubjectGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subjects"
    )

    name = models.CharField(
        max_length=120
    )

    short_name = models.CharField(
        max_length=50,
        blank=True
    )

    code = models.CharField(
        max_length=20,
        blank=True
    )

    is_compulsory = models.BooleanField(
        default=True
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:

        ordering = ["name"]

        unique_together = (
            "school",
            "name"
        )

    def __str__(self):

        return self.name



# =========================================================
# GRADE LEVEL SUBJECT ASSIGNMENT
# =========================================================

class GradeLevelSubject(models.Model):
    """
    Assign subjects to grade levels.

    This is CRITICAL for flexibility.
    """

    grade_level = models.ForeignKey(
        GradeLevel,
        on_delete=models.CASCADE,
        related_name="grade_subjects"
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="grade_subjects"
    )

    pathway = models.ForeignKey(
        Pathway,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="grade_subjects"
    )


    is_compulsory = models.BooleanField(
        default=True
    )

    order = models.PositiveIntegerField(
        default=0
    )

    class Meta:

        ordering = ["order"]

        unique_together = (
            "grade_level",
            "subject"
        )

    def __str__(self):

        return f"{self.grade_level.name} - {self.subject.name}"

# =========================================================
# ACADEMIC YEAR
# =========================================================

class AcademicYear(models.Model):

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="academic_years",
        null=True,
        blank=True
    )

    name = models.CharField(
        max_length=20
    )

    start_date = models.DateField()

    end_date = models.DateField()

    is_active = models.BooleanField(
        default=False
    )

    class Meta:

        ordering = ["-start_date"]

        unique_together = (
            "school",
            "name"
        )

    def __str__(self):

        return self.name

# =========================================================
# SUBJECT TEACHER ASSIGNMENT
# =========================================================
class SubjectTeacher(models.Model):

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="subject_teachers",
        null=True,
        blank=True
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="teachers"
    )

    grade_level = models.ForeignKey(
        GradeLevel,
        on_delete=models.CASCADE,
        related_name="subject_teachers"
    )

    stream = models.ForeignKey(
        Stream,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    teacher = models.ForeignKey(
        "staff.Staff",
        on_delete=models.CASCADE,
        related_name="subject_assignments"
    )

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:

        unique_together = (
            "teacher",
            "subject",
            "grade_level",
            "stream",
            "academic_year"
        )
# =========================================================
# TERM / SEMESTER
# =========================================================

class Term(models.Model):

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE,
        related_name="terms"
    )

    name = models.CharField(
        max_length=50
    )

    start_date = models.DateField()

    end_date = models.DateField()

    order = models.PositiveIntegerField(
        default=1
    )

    class Meta:

        ordering = ["order"]

        unique_together = (
            "academic_year",
            "name"
        )

    def __str__(self):

        return f"{self.academic_year.name} - {self.name}"