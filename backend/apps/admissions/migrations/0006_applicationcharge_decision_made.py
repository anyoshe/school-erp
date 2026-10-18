from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0005_application_birth_certificate_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="applicationcharge",
            name="decision_made",
            field=models.BooleanField(
                default=False,
                help_text="True after staff sets policy (N/A, waive, discount, or pay)",
            ),
        ),
    ]
