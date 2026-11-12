from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("elearning", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lesson",
            name="attachment",
            field=models.FileField(
                blank=True,
                max_length=512,
                null=True,
                upload_to="lessons/",
            ),
        ),
        migrations.AlterField(
            model_name="submission",
            name="file",
            field=models.FileField(
                blank=True,
                max_length=512,
                null=True,
                upload_to="submissions/",
            ),
        ),
    ]
