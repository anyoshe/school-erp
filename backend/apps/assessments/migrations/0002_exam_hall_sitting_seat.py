import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0005_section_class_teacher"),
        ("students", "0002_initial"),
        ("school", "0005_admission_number_settings_align"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("assessments", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExamHall",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("building", models.CharField(blank=True, max_length=120)),
                ("capacity", models.PositiveIntegerField(default=30)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exam_halls",
                        to="school.school",
                    ),
                ),
            ],
            options={"ordering": ["name"], "unique_together": {("school", "name")}},
        ),
        migrations.CreateModel(
            name="ExamSitting",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("exam_date", models.DateField()),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("instructions", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "academic_year",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exam_sittings",
                        to="academics.academicyear",
                    ),
                ),
                (
                    "assessment",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sittings",
                        to="assessments.assessment",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="exam_sittings_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "grade_level",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exam_sittings",
                        to="academics.gradelevel",
                    ),
                ),
                (
                    "hall",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="sittings",
                        to="assessments.examhall",
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exam_sittings",
                        to="school.school",
                    ),
                ),
                (
                    "subject",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exam_sittings",
                        to="academics.subject",
                    ),
                ),
                (
                    "term",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="exam_sittings",
                        to="academics.term",
                    ),
                ),
            ],
            options={"ordering": ["exam_date", "start_time"]},
        ),
        migrations.CreateModel(
            name="ExamSeat",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("seat_label", models.CharField(max_length=20)),
                ("row_label", models.CharField(blank=True, max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "sitting",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="seats",
                        to="assessments.examsitting",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exam_seats",
                        to="students.student",
                    ),
                ),
            ],
            options={
                "ordering": ["seat_label"],
                "unique_together": {("sitting", "seat_label"), ("sitting", "student")},
            },
        ),
    ]
