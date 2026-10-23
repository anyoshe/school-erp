
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("admissions", "0007_secondary_guardian_and_status_log"),
    ]

    operations = [
        migrations.AlterField(
            model_name="application",
            name="secondary_guardian_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AlterField(
            model_name="application",
            name="secondary_guardian_phone",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AlterField(
            model_name="application",
            name="secondary_guardian_relationship",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AlterField(
            model_name="application",
            name="secondary_guardian_id_number",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.RunSQL(
            sql="UPDATE admissions_application SET secondary_guardian_name = COALESCE(secondary_guardian_name, '');",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
