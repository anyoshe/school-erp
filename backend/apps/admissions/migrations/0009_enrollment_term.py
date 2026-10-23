
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("admissions", "0008_secondary_guardian_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="application",
            name="enrollment_term",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="application",
            name="enrollment_academic_year",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
    ]
