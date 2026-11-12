from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0009_enrollment_term"),
    ]

    operations = [
        migrations.AlterField(
            model_name="application",
            name="photo",
            field=models.ImageField(
                blank=True,
                max_length=512,
                null=True,
                upload_to="admission_photos/",
            ),
        ),
        migrations.AlterField(
            model_name="applicationdocument",
            name="file",
            field=models.FileField(max_length=512, upload_to="admission_documents/"),
        ),
    ]
