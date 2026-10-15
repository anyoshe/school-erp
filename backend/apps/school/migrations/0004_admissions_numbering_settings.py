from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("school", "0003_schoolsupportsession_one_active_school_support_per_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="school",
            name="assign_admission_number_on",
            field=models.CharField(
                choices=[
                    ("ENROLL", "On enroll (recommended)"),
                    ("ACCEPT", "When offer is accepted"),
                    ("SUBMIT", "When application is submitted"),
                ],
                default="ENROLL",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="school",
            name="require_admission_fee_before_enroll",
            field=models.BooleanField(
                default=False,
                help_text="If true, enroll is blocked until admission_fee is fully paid on the application.",
            ),
        ),
        migrations.AddField(
            model_name="school",
            name="receipt_prefix",
            field=models.CharField(
                blank=True,
                help_text="Prefix for payment receipts, e.g. RCP-SCH",
                max_length=20,
            ),
        ),
    ]
