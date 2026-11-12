from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0003_library_management_v1"),
    ]

    operations = [
        migrations.AddField(
            model_name="borrowing",
            name="is_allocation_loan",
            field=models.BooleanField(
                default=False,
                help_text="True when this loan is an academic-year / class textbook allocation, not a short-term borrow.",
            ),
        ),
        migrations.AddField(
            model_name="classallocation",
            name="kind",
            field=models.CharField(
                choices=[("INDIVIDUAL", "Individual learner"), ("CLASS_POOL", "Class pool")],
                default="INDIVIDUAL",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="classallocation",
            name="subject",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
