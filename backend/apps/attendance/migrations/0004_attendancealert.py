import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0003_studentattendance"),
        ("students", "0002_initial"),
        ("school", "0005_admission_number_settings_align"),
    ]

    operations = [
        migrations.CreateModel(
            name="AttendanceAlert",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("date", models.DateField()),
                (
                    "channel",
                    models.CharField(
                        choices=[("WHATSAPP", "WhatsApp"), ("SMS", "SMS"), ("LOG", "Log only")],
                        default="WHATSAPP",
                        max_length=12,
                    ),
                ),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("message", models.TextField(blank=True)),
                (
                    "outcome",
                    models.CharField(
                        choices=[("SENT", "Sent"), ("FAILED", "Failed"), ("SKIPPED", "Skipped")],
                        default="SKIPPED",
                        max_length=12,
                    ),
                ),
                ("detail", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "attendance",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="alerts",
                        to="attendance.studentattendance",
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendance_alerts",
                        to="school.school",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendance_alerts",
                        to="students.student",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
