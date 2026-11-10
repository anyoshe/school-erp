from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("school", "0001_initial"),
        ("risks", "0002_riskdigestlog"),
    ]

    operations = [
        migrations.CreateModel(
            name="SchoolRiskSettings",
            fields=[
                ("school", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, related_name="risk_settings", serialize=False, to="school.school")),
                ("enable_fee", models.BooleanField(default=True)),
                ("enable_attendance", models.BooleanField(default=True)),
                ("enable_academic", models.BooleanField(default=True)),
                ("enable_ops", models.BooleanField(default=True)),
                ("mid_term_collection_threshold", models.DecimalField(decimal_places=2, default=0.4, help_text="Flag when paid/due is below this ratio mid-term (e.g. 0.40 = 40%)", max_digits=4)),
                ("mid_term_elapsed_threshold", models.DecimalField(decimal_places=2, default=0.4, help_text="Only apply mid-term lag after this fraction of the term has elapsed", max_digits=4)),
                ("consecutive_absent_days", models.PositiveSmallIntegerField(default=3)),
                ("mon_fri_absent_count", models.PositiveSmallIntegerField(default=3)),
                ("chronic_absent_60d", models.PositiveSmallIntegerField(default=7)),
                ("absence_rate_window_days", models.PositiveSmallIntegerField(default=15)),
                ("absence_rate_delta", models.DecimalField(decimal_places=2, default=0.15, help_text="Minimum rise in absence rate (e.g. 0.15 = +15 points)", max_digits=4)),
                ("cat_drop_points", models.DecimalField(decimal_places=2, default=15, help_text="Point drop from first to latest CAT that triggers trajectory risk", max_digits=5)),
                ("burn_multiplier", models.DecimalField(decimal_places=2, default=1.25, max_digits=4)),
                ("burn_window_days", models.PositiveSmallIntegerField(default=7)),
                ("digest_channel", models.CharField(default="LOG", help_text="LOG | WHATSAPP | EMAIL | BOTH", max_length=20)),
                ("digest_limit", models.PositiveSmallIntegerField(default=5)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
