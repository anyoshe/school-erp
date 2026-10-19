from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("school", "0004_pre_enrollment_fee_settings"),
    ]

    operations = [
        migrations.AlterField(
            model_name="school",
            name="admission_number_format",
            field=models.CharField(
                choices=[
                    ("PREFIX_SEQ", "Prefix + Sequential (PSS001)"),
                    ("YEAR_SEQ", "Year + Sequential (2026-0001)"),
                    ("PREFIX_YEAR_SEQ", "Prefix + Year + Sequential (ABC-2026-0001)"),
                    ("CUSTOM", "Manual entry only"),
                ],
                default="PREFIX_SEQ",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="school",
            name="admission_prefix",
            field=models.CharField(
                blank=True,
                help_text="School code for numbers, e.g. PSS → PSS001, PSS002",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="school",
            name="admission_seq_padding",
            field=models.PositiveSmallIntegerField(
                default=3,
                help_text="Digits after prefix, e.g. 3 → PSS001",
            ),
        ),
    ]
