import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0002_alter_attendance_unique_together_attendance_school_and_more"),
        ("students", "0002_initial"),
        ("academics", "0004_term_is_current"),
        ("school", "0005_admission_number_settings_align"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StudentAttendance",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("date", models.DateField(db_index=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PRESENT", "Present"),
                            ("ABSENT", "Absent"),
                            ("LATE", "Late"),
                            ("EXCUSED", "Excused"),
                        ],
                        default="PRESENT",
                        max_length=10,
                    ),
                ),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "grade_level",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="attendance_records",
                        to="academics.gradelevel",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="student_attendance_recorded",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_attendance",
                        to="school.school",
                    ),
                ),
                (
                    "section",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="attendance_records",
                        to="academics.section",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendance_records",
                        to="students.student",
                    ),
                ),
            ],
            options={
                "ordering": ["-date", "student__last_name"],
                "unique_together": {("school", "student", "date")},
            },
        ),
        migrations.AddIndex(
            model_name="studentattendance",
            index=models.Index(fields=["school", "date"], name="att_stu_school_date_idx"),
        ),
        migrations.AddIndex(
            model_name="studentattendance",
            index=models.Index(fields=["school", "grade_level", "date"], name="att_stu_school_grade_date_idx"),
        ),
    ]
