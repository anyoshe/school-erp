from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0003_application_rejection_notes"),
    ]

    operations = [
        migrations.CreateModel(
            name="ApplicationCharge",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("charge_type", models.CharField(choices=[("INTERVIEW", "Interview fee"), ("ADMISSION", "Admission / registration fee")], max_length=20)),
                ("policy", models.CharField(choices=[("FULL", "Full amount due"), ("DISCOUNTED", "Discounted"), ("WAIVED", "Waived"), ("NOT_APPLICABLE", "Not applicable")], default="NOT_APPLICABLE", max_length=20)),
                ("list_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("discount_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("amount_due", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("amount_paid", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("waiver_reason", models.CharField(blank=True, max_length=255)),
                ("notes", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("application", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="charges", to="admissions.application")),
            ],
            options={
                "ordering": ["charge_type"],
                "unique_together": {("application", "charge_type")},
            },
        ),
    ]
