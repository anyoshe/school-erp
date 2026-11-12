from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("school", "0005_admission_number_settings_align"),
    ]

    operations = [
        migrations.AlterField(
            model_name="school",
            name="logo",
            field=models.ImageField(
                blank=True,
                max_length=512,
                null=True,
                upload_to="school_logos/",
            ),
        ),
    ]
