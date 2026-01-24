# # apps/academics/models.py
# from django.db import models
# from django.core.exceptions import ValidationError
# from apps.school.models import School
# from rest_framework.decorators import action


# class Curriculum(models.Model):
#     school = models.ForeignKey(
#         School,
#         on_delete=models.CASCADE,
#         related_name="curricula",
#         null=True,
#         blank=True,
#         help_text="Null for global templates"
#     )
#     name = models.CharField(max_length=120)
#     short_code = models.CharField(max_length=20, blank=True)
#     description = models.TextField(blank=True)
#     is_active = models.BooleanField(default=True)
#     is_template = models.BooleanField(
#         default=False,
#         help_text="True if this is a global template (school should be null)"
#     )

#     # Optional school overrides
#     term_system = models.CharField(max_length=20, blank=True, null=True)
#     number_of_terms = models.PositiveIntegerField(null=True, blank=True)
#     grading_system = models.CharField(max_length=20, blank=True, null=True)
#     passing_mark = models.PositiveIntegerField(null=True, blank=True)

#     class Meta:
#         ordering = ["-is_template", "name"]
#         constraints = [
#             # Ensure template consistency
#             models.CheckConstraint(
#                 check=models.Q(school__isnull=True, is_template=True) |
#                       models.Q(school__isnull=False, is_template=False),
#                 name="curriculum_template_school_consistency"
#             ),
#             # Unique name per school (when school is not null)
#             models.UniqueConstraint(
#                 fields=['school', 'name'],
#                 condition=models.Q(school__isnull=False),
#                 name="curriculum_unique_name_per_school"
#             ),
#             # Unique name among templates
#             models.UniqueConstraint(
#                 fields=['name'],
#                 condition=models.Q(school__isnull=True, is_template=True),
#                 name="curriculum_unique_template_name"
#             ),
#         ]

#     def clean(self):
#         if self.is_template and self.school is not None:
#             raise ValidationError("Templates must have school = null")
#         if not self.is_template and self.school is None:
#             raise ValidationError("School-specific curricula must have a school")

#     def __str__(self):
#         if self.is_template:
#             return f"[Template] {self.name}"
#         return f"{self.name} ({self.school})"


# class GradeLevel(models.Model):
#     school = models.ForeignKey(
#         School,
#         on_delete=models.CASCADE,
#         related_name="grade_levels",
#         null=True,
#         blank=True
#     )
#     curriculum = models.ForeignKey(
#         Curriculum,
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name="grade_levels"
#     )
#     name = models.CharField(max_length=80)
#     short_name = models.CharField(max_length=30, blank=True)
#     order = models.PositiveIntegerField(default=0)
#     code = models.CharField(max_length=20, blank=True)

#     class Meta:
#         ordering = ["order", "name"]
#         constraints = [
#             models.UniqueConstraint(
#                 fields=['school', 'name'],
#                 condition=models.Q(school__isnull=False),
#                 name="gradelevel_unique_name_per_school"
#             ),
#         ]

#     def clean(self):
#         if self.school is None and self.curriculum and self.curriculum.is_template:
#             pass  # Allow templates without school
#         elif self.school is None:
#             raise ValidationError("School-specific grade levels must have a school")

#     def __str__(self):
#         return self.name


# class Department(models.Model):
#     school = models.ForeignKey(
#         School,
#         on_delete=models.CASCADE,
#         related_name="departments",
#         null=True,
#         blank=True
#     )
#     curriculum = models.ForeignKey(
#         Curriculum,
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name="departments"
#     )
#     name = models.CharField(max_length=120)
#     short_name = models.CharField(max_length=50, blank=True)
#     code = models.CharField(max_length=20, blank=True)

#     class Meta:
#         ordering = ["name"]
#         constraints = [
#             models.UniqueConstraint(
#                 fields=['school', 'name'],
#                 condition=models.Q(school__isnull=False),
#                 name="department_unique_name_per_school"
#             ),
#         ]

#     def clean(self):
#         if self.school is None and self.curriculum and self.curriculum.is_template:
#             pass
#         elif self.school is None:
#             raise ValidationError("School-specific departments must have a school")

#     def __str__(self):
#         return self.name

# apps/academics/models.py
from django.db import models
from django.core.exceptions import ValidationError
from apps.school.models import School


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
    short_code = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_template = models.BooleanField(
        default=False,
        help_text="True if this is a global template (school should be null)"
    )

    # Optional school overrides
    term_system = models.CharField(max_length=20, blank=True, null=True)
    number_of_terms = models.PositiveIntegerField(null=True, blank=True)
    grading_system = models.CharField(max_length=20, blank=True, null=True)
    passing_mark = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-is_template", "name"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(school__isnull=True, is_template=True) |
                      models.Q(school__isnull=False, is_template=False),
                name="curriculum_template_school_consistency"
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
            raise ValidationError("Templates must have school = null")
        if not self.is_template and self.school is None:
            raise ValidationError("School-specific curricula must have a school")

    def __str__(self):
        if self.is_template:
            return f"[Template] {self.name}"
        return f"{self.name} ({self.school})"


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
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="grade_levels"
    )
    name = models.CharField(max_length=80)
    short_name = models.CharField(max_length=30, blank=True)
    order = models.PositiveIntegerField(default=0)
    code = models.CharField(max_length=20, blank=True)

    # Global education level classification
    EDUCATION_LEVEL_CHOICES = [
        ('PRE_PRIMARY', 'Pre-Primary / Kindergarten'),
        ('ELEMENTARY', 'Elementary / Primary'),
        ('MIDDLE', 'Middle / Junior Secondary'),
        ('HIGH', 'High / Senior Secondary'),
        ('OTHER', 'Other / Vocational / Special'),
    ]
    education_level = models.CharField(
        max_length=20,
        choices=EDUCATION_LEVEL_CHOICES,
        default='ELEMENTARY',
        blank=True,
        help_text="Used for conditional logic in admissions, reports, etc."
    )

    # Optional stream / pathway (senior levels, boarding houses, etc.)
    PATHWAY_CHOICES = [
        ('GENERAL', 'General / No Pathway'),
        ('STEM', 'STEM / Sciences'),
        ('ARTS', 'Arts / Humanities'),
        ('VOCATIONAL', 'Vocational / TVET'),
        ('OTHER', 'Other / Custom'),
    ]
    pathway = models.CharField(
        max_length=20,
        choices=PATHWAY_CHOICES,
        default='GENERAL',
        blank=True,
        help_text="Optional – used for senior secondary pathways, streams, etc."
    )

    class Meta:
        ordering = ["order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=['school', 'name'],
                condition=models.Q(school__isnull=False),
                name="gradelevel_unique_name_per_school"
            ),
        ]

    def clean(self):
        # Template / school consistency
        if self.school is None and self.curriculum and self.curriculum.is_template:
            pass  # Allowed for template-linked levels
        elif self.school is None:
            raise ValidationError("School-specific grade levels must have a school")

        # Optional: warn if pathway is set on non-senior level
        if self.pathway != 'GENERAL' and self.education_level not in ['HIGH', 'MIDDLE', 'OTHER']:
            # You could raise ValidationError here, or just log/warn
            pass  # Currently permissive – adjust as needed

    def __str__(self):
        return self.name


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
    name = models.CharField(max_length=120)
    short_name = models.CharField(max_length=50, blank=True)
    code = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=['school', 'name'],
                condition=models.Q(school__isnull=False),
                name="department_unique_name_per_school"
            ),
        ]

    def clean(self):
        if self.school is None and self.curriculum and self.curriculum.is_template:
            pass
        elif self.school is None:
            raise ValidationError("School-specific departments must have a school")

    def __str__(self):
        return self.name