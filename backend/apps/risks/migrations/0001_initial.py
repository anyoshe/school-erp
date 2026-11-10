import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("school", "0001_initial"),
        ("students", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="RiskAlert",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("category", models.CharField(choices=[("FEE", "Fee / revenue"), ("ATTENDANCE", "Attendance / retention"), ("ACADEMIC", "Academic trajectory"), ("OPS", "Operations")], db_index=True, max_length=20)),
                ("severity", models.CharField(choices=[("HIGH", "High"), ("MEDIUM", "Medium"), ("LOW", "Low")], db_index=True, default="MEDIUM", max_length=10)),
                ("status", models.CharField(choices=[("OPEN", "Open"), ("ACKNOWLEDGED", "Acknowledged"), ("RESOLVED", "Resolved")], db_index=True, default="OPEN", max_length=20)),
                ("fingerprint", models.CharField(db_index=True, max_length=180)),
                ("title", models.CharField(max_length=200)),
                ("detail", models.TextField(blank=True)),
                ("metrics", models.JSONField(blank=True, default=dict)),
                ("action_path", models.CharField(blank=True, max_length=255)),
                ("detected_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("acknowledged_at", models.DateTimeField(blank=True, null=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("acknowledged_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="acknowledged_risks", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="risk_alerts", to="school.school")),
                ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="risk_alerts", to="students.student")),
            ],
            options={
                "ordering": ["-severity", "-updated_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="riskalert",
            constraint=models.UniqueConstraint(fields=("school", "fingerprint"), name="risks_alert_unique_fingerprint_per_school"),
        ),
        migrations.AddIndex(
            model_name="riskalert",
            index=models.Index(fields=["school", "status", "category"], name="risks_alert_school_status_cat"),
        ),
    ]
