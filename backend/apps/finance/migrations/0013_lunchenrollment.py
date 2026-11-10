from decimal import Decimal
import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("finance", "0012_journal_double_entry"),
    ]

    operations = [
        migrations.CreateModel(
            name="LunchEnrollment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("ACTIVE", "Active"), ("PAUSED", "Paused"), ("ENDED", "Ended")], db_index=True, default="ACTIVE", max_length=16)),
                ("plan_type", models.CharField(choices=[("TERM", "Per term (package)"), ("MONTHLY", "Monthly"), ("WEEKLY", "Weekly"), ("DAILY", "Daily rate")], default="TERM", max_length=16)),
                ("amount", models.DecimalField(decimal_places=2, default=Decimal("0"), help_text="Agreed charge per plan period (term / month / week / day)", max_digits=12)),
                ("absence_rule", models.CharField(choices=[("CHARGE_FULL", "Still charge (place reserved)"), ("CREDIT_UNUSED", "Credit unused days (manual/policy)"), ("CHARGE_USAGE", "Charge only days eaten (needs meal register)")], default="CHARGE_FULL", max_length=20)),
                ("academic_year", models.CharField(blank=True, default="", max_length=32)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("notes", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lunch_enrollments_created", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lunch_enrollments", to="school.school")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lunch_enrollments", to="students.student")),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
        migrations.AddIndex(
            model_name="lunchenrollment",
            index=models.Index(fields=["school", "status"], name="finance_lunch_sch_st_idx"),
        ),
        migrations.AddIndex(
            model_name="lunchenrollment",
            index=models.Index(fields=["student", "status"], name="finance_lunch_stu_st_idx"),
        ),
    ]
