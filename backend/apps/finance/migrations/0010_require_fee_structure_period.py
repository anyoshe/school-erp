from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0009_invoiceline_waive_discount"),
    ]

    operations = [
        migrations.AlterField(
            model_name="feestructure",
            name="academic_year",
            field=models.CharField(max_length=9),
        ),
        migrations.AlterField(
            model_name="feestructure",
            name="period_name",
            field=models.CharField(
                help_text="e.g. Term 1, Semester 2, etc.",
                max_length=50,
            ),
        ),
    ]
