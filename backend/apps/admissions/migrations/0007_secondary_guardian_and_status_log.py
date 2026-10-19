from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("admissions", "0006_applicationcharge_decision_made"),
    ]

    operations = [
        migrations.AddField(
            model_name="application",
            name="secondary_guardian_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="application",
            name="secondary_guardian_phone",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="application",
            name="secondary_guardian_email",
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name="application",
            name="secondary_guardian_relationship",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="application",
            name="secondary_guardian_id_number",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.CreateModel(
            name="ApplicationStatusLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("from_status", models.CharField(blank=True, max_length=30)),
                ("to_status", models.CharField(max_length=30)),
                ("note", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("application", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="status_logs", to="admissions.application")),
                ("changed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="admission_status_changes", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
