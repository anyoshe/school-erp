from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0002_staff_school"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="staff",
            options={"ordering": ["user__last_name", "user__first_name", "user__email"]},
        ),
        migrations.AlterField(
            model_name="staff",
            name="department",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="staff",
            name="employee_number",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="staff",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="staff",
            name="job_title",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="staff",
            name="notes",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="staff",
            name="phone",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AlterField(
            model_name="staff",
            name="hire_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="staff",
            name="role",
            field=models.CharField(
                choices=[
                    ("TEACHER", "Teacher"),
                    ("LIBRARIAN", "Librarian"),
                    ("ACCOUNTANT", "Accountant"),
                    ("PRINCIPAL", "Principal / Head"),
                    ("ADMIN", "Admin / Office"),
                    ("SUPPORT", "Support staff"),
                    ("OTHER", "Other"),
                ],
                default="TEACHER",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="payroll",
            name="staff",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="payroll_rows",
                to="staff.staff",
            ),
        ),
        migrations.AddIndex(
            model_name="staff",
            index=models.Index(fields=["school", "role"], name="staff_stf_sch_role_idx"),
        ),
        migrations.AddIndex(
            model_name="staff",
            index=models.Index(fields=["school", "is_active"], name="staff_stf_sch_active_idx"),
        ),
    ]
