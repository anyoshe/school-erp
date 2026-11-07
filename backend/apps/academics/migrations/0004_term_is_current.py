from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0003_graderequirement"),
    ]

    operations = [
        migrations.AddField(
            model_name="term",
            name="is_current",
            field=models.BooleanField(
                default=False,
                help_text="When true, this is the school's current teaching term (within the active year).",
            ),
        ),
    ]
