from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("school", "0004_pre_enrollment_fee_settings"),
        ("students", "0002_initial"),
        ("finance", "0003_invoice_number_per_school"),
    ]

    operations = [
        migrations.CreateModel(
            name="Account",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=20)),
                ("name", models.CharField(max_length=120)),
                ("account_type", models.CharField(choices=[("INCOME", "Income"), ("ASSET", "Asset"), ("LIABILITY", "Liability"), ("EXPENSE", "Expense")], max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="accounts", to="school.school")),
            ],
            options={"ordering": ["code"], "unique_together": {("school", "code")}},
        ),
        migrations.CreateModel(
            name="IncomeReceipt",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("application_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("source", models.CharField(choices=[("INTERVIEW", "Interview fee"), ("ADMISSION", "Admission / registration fee"), ("OTHER", "Other")], max_length=20)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_method", models.CharField(blank=True, default="CASH", max_length=50)),
                ("reference_number", models.CharField(blank=True, max_length=100)),
                ("notes", models.TextField(blank=True)),
                ("paid_at", models.DateTimeField(auto_now_add=True)),
                ("charge_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("account", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="income_receipts", to="finance.account")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="income_receipts", to="school.school")),
                ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="income_receipts", to="students.student")),
            ],
            options={"ordering": ["-paid_at"]},
        ),
    ]
