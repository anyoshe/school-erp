from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("school", "0003_schoolsupportsession_one_active_school_support_per_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="school",
            name="admission_fee_amount",
            field=models.DecimalField(decimal_places=2, default=0, help_text="One-time admission/registration fee (0 = treat as N/A by default)", max_digits=12),
        ),
        migrations.AddField(
            model_name="school",
            name="interview_fee_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="school",
            name="interview_fee_enabled",
            field=models.BooleanField(default=False, help_text="If true, interview fee applies unless marked N/A on the application"),
        ),
        migrations.AddField(
            model_name="school",
            name="require_admission_fee_before_enroll",
            field=models.BooleanField(default=False, help_text="If true, enroll is blocked until admission charge is satisfied"),
        ),
    ]
