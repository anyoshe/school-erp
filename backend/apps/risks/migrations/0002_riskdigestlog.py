import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("school", "0001_initial"),
        ("risks", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="RiskDigestLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("digest_date", models.DateField(db_index=True)),
                ("channel", models.CharField(choices=[("LOG", "Log only"), ("WHATSAPP", "WhatsApp"), ("EMAIL", "Email"), ("BOTH", "WhatsApp + Email")], default="LOG", max_length=20)),
                ("alert_count", models.PositiveIntegerField(default=0)),
                ("high_count", models.PositiveIntegerField(default=0)),
                ("message_preview", models.TextField(blank=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("ok", models.BooleanField(default=True)),
                ("detail", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="risk_digests", to="school.school")),
            ],
            options={"ordering": ["-digest_date", "-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="riskdigestlog",
            constraint=models.UniqueConstraint(fields=("school", "digest_date", "channel"), name="risks_digest_unique_school_date_channel"),
        ),
    ]
