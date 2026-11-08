from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("students", "0002_initial"),
        ("school", "0005_admission_number_settings_align"),
        ("parent_portal", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ParentStudentLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_primary", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "guardian_profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_links",
                        to="parent_portal.guardianprofile",
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="parent_student_links",
                        to="school.school",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="parent_links",
                        to="students.student",
                    ),
                ),
            ],
            options={"unique_together": {("guardian_profile", "student")}},
        ),
    ]
