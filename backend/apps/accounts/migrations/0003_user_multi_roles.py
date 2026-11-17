from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_initial"),
        ("school", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("SUPER_ADMIN", "Super Admin / Owner"),
                    ("SCHOOL_ADMIN", "School Administrator"),
                    ("PRINCIPAL", "Principal / Head Teacher"),
                    ("DEPUTY_PRINCIPAL", "Deputy Principal / Vice Principal"),
                    ("MANAGER", "School Manager"),
                    ("ADMISSIONS_OFFICER", "Admissions Officer / Registrar"),
                    ("ACCOUNTANT", "Accountant / Bursar"),
                    ("BURSAR", "Bursar"),
                    ("ACADEMIC_COORDINATOR", "Academic Coordinator / Head of Section"),
                    ("TEACHER", "Teacher"),
                    ("LIBRARIAN", "Librarian"),
                    ("SECRETARY", "Secretary / Admin Assistant"),
                    ("HR_MANAGER", "HR Manager"),
                    ("PARENT", "Parent"),
                    ("STUDENT", "Student"),
                ],
                default="SUPER_ADMIN",
                help_text="Primary role (legacy / login default). Prefer assigned roles M2M for multi-role.",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="roles",
            field=models.ManyToManyField(
                blank=True,
                help_text="All roles granted to this user (union of module access).",
                related_name="assigned_users",
                to="accounts.role",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="extra_modules",
            field=models.ManyToManyField(
                blank=True,
                help_text="Additional modules granted on top of role defaults.",
                related_name="users_with_extra_access",
                to="school.module",
            ),
        ),
    ]
