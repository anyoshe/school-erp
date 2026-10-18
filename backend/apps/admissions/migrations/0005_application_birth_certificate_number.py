from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0004_applicationcharge"),
    ]

    operations = [
        migrations.AddField(
            model_name="application",
            name="birth_certificate_number",
            field=models.CharField(
                blank=True,
                max_length=50,
                verbose_name="Birth Certificate Number",
            ),
        ),
    ]
