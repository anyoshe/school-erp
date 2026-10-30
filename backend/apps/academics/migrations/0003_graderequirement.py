from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0002_alter_academicyear_school_alter_department_school_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="GradeRequirement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_text", models.CharField(max_length=255)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "grade_level",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="admission_requirements",
                        to="academics.gradelevel",
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="grade_requirements",
                        to="school.school",
                    ),
                ),
            ],
            options={
                "ordering": ["grade_level__order", "sort_order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="graderequirement",
            index=models.Index(fields=["school", "grade_level"], name="academics_g_school_req_idx"),
        ),
    ]
