from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0005_section_class_teacher"),
    ]

    operations = [
        migrations.AddField(
            model_name="term",
            name="is_locked",
            field=models.BooleanField(
                default=False,
                help_text="When true, marks for this term are view-only (no new entry or edits).",
            ),
        ),
    ]
