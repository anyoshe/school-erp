from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0003_staff_hr_fields"),
        ("academics", "0004_term_is_current"),
    ]

    operations = [
        migrations.AddField(
            model_name="section",
            name="class_teacher",
            field=models.ForeignKey(
                blank=True,
                help_text="Homeroom / class teacher responsible for this section",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="class_sections",
                to="staff.staff",
            ),
        ),
    ]
