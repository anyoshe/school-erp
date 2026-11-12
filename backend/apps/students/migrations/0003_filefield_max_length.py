from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0002_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="student",
            name="photo",
            field=models.ImageField(
                blank=True,
                max_length=512,
                null=True,
                upload_to="student_photos/",
            ),
        ),
        migrations.AlterField(
            model_name="medicaldocument",
            name="file",
            field=models.FileField(max_length=512, upload_to="medical_documents/"),
        ),
    ]
