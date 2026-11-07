import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("school", "0005_admission_number_settings_align"),
        ("academics", "0004_term_is_current"),
        ("students", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Assessment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("CAT", "CAT / Continuous"),
                            ("MIDTERM", "Midterm"),
                            ("END_TERM", "End of term"),
                            ("PROJECT", "Project"),
                            ("OTHER", "Other"),
                        ],
                        default="CAT",
                        max_length=20,
                    ),
                ),
                (
                    "max_score",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("100"),
                        max_digits=7,
                        validators=[django.core.validators.MinValueValidator(Decimal("1"))],
                    ),
                ),
                (
                    "weight",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("1"),
                        help_text="Relative weight for future term totals",
                        max_digits=5,
                        validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                    ),
                ),
                ("assessment_date", models.DateField(blank=True, null=True)),
                ("is_published", models.BooleanField(default=False)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "academic_year",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assessments",
                        to="academics.academicyear",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assessments_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "grade_level",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assessments",
                        to="academics.gradelevel",
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assessments",
                        to="school.school",
                    ),
                ),
                (
                    "section",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assessments",
                        to="academics.section",
                    ),
                ),
                (
                    "subject",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assessments",
                        to="academics.subject",
                    ),
                ),
                (
                    "term",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assessments",
                        to="academics.term",
                    ),
                ),
            ],
            options={"ordering": ["-assessment_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="Mark",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "score",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=7,
                        null=True,
                        validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                    ),
                ),
                ("is_absent", models.BooleanField(default=False)),
                ("remarks", models.CharField(blank=True, max_length=255)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "assessment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marks",
                        to="assessments.assessment",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="marks_recorded",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marks",
                        to="school.school",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marks",
                        to="students.student",
                    ),
                ),
            ],
            options={
                "ordering": ["student__last_name", "student__first_name"],
                "unique_together": {("assessment", "student")},
            },
        ),
        migrations.AddIndex(
            model_name="assessment",
            index=models.Index(fields=["school", "academic_year", "grade_level"], name="assess_sch_year_grade_idx"),
        ),
        migrations.AddIndex(
            model_name="assessment",
            index=models.Index(fields=["school", "subject"], name="assess_sch_subject_idx"),
        ),
    ]
