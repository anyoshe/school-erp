from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0002_fix_unique_per_school"),
    ]

    operations = [
        migrations.AddField(
            model_name="application",
            name="rejection_reason",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="application",
            name="internal_notes",
            field=models.TextField(blank=True),
        ),
    ]
