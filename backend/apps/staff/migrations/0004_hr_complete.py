from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("school", "0005_admission_number_settings_align"),
        ("staff", "0003_staff_hr_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="staff",
            name="employment_type",
            field=models.CharField(
                choices=[
                    ("PERMANENT", "Permanent"),
                    ("CONTRACT", "Contract"),
                    ("PART_TIME", "Part-time"),
                    ("TEMPORARY", "Temporary"),
                    ("INTERN", "Intern / Volunteer"),
                ],
                default="PERMANENT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="staff",
            name="gender",
            field=models.CharField(
                blank=True,
                choices=[("MALE", "Male"), ("FEMALE", "Female"), ("OTHER", "Other")],
                default="",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="staff",
            name="national_id",
            field=models.CharField(blank=True, default="", max_length=40, verbose_name="National ID"),
        ),
        migrations.AddField(
            model_name="staff",
            name="tsc_number",
            field=models.CharField(blank=True, default="", max_length=40, verbose_name="TSC number"),
        ),
        migrations.AddField(
            model_name="staff",
            name="bank_name",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="staff",
            name="bank_account",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="staff",
            name="next_of_kin",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="staff",
            name="next_of_kin_phone",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="staff",
            name="exit_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payroll",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Draft"),
                    ("APPROVED", "Approved"),
                    ("PAID", "Paid"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="DRAFT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="payroll",
            name="paid_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payroll",
            name="notes",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="payroll",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name="payroll",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AlterField(
            model_name="payroll",
            name="basic_salary",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterField(
            model_name="payroll",
            name="allowances",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=12),
        ),
        migrations.AlterField(
            model_name="payroll",
            name="deductions",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=12),
        ),
        migrations.AlterField(
            model_name="payroll",
            name="net_salary",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterUniqueTogether(
            name="payroll",
            unique_together={("staff", "month")},
        ),
        migrations.CreateModel(
            name="LeaveRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "leave_type",
                    models.CharField(
                        choices=[
                            ("ANNUAL", "Annual leave"),
                            ("SICK", "Sick leave"),
                            ("MATERNITY", "Maternity"),
                            ("PATERNITY", "Paternity"),
                            ("COMPASSIONATE", "Compassionate"),
                            ("UNPAID", "Unpaid"),
                            ("OTHER", "Other"),
                        ],
                        default="ANNUAL",
                        max_length=20,
                    ),
                ),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("days", models.PositiveIntegerField(default=1)),
                ("reason", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending"),
                            ("APPROVED", "Approved"),
                            ("REJECTED", "Rejected"),
                            ("CANCELLED", "Cancelled"),
                        ],
                        default="PENDING",
                        max_length=20,
                    ),
                ),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("review_notes", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="leave_reviews",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="leave_requests",
                        to="school.school",
                    ),
                ),
                (
                    "staff",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="leave_requests",
                        to="staff.staff",
                    ),
                ),
            ],
            options={"ordering": ["-start_date", "-created_at"]},
        ),
    ]
