import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("school", "0005_admission_number_settings_align"),
        ("finance", "0005_ensure_account_incomereceipt"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExpenseCategory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="expense_categories", to="school.school")),
            ],
            options={"ordering": ["name"], "unique_together": {("school", "name")}},
        ),
        migrations.CreateModel(
            name="Vendor",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("phone", models.CharField(blank=True, max_length=40)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="finance_vendors", to="school.school")),
            ],
            options={"ordering": ["name"], "unique_together": {("school", "name")}},
        ),
        migrations.CreateModel(
            name="Expense",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("expense_date", models.DateField()),
                ("payment_method", models.CharField(choices=[("CASH", "Cash"), ("BANK", "Bank transfer"), ("MPESA", "M-Pesa"), ("CHEQUE", "Cheque"), ("OTHER", "Other")], default="CASH", max_length=20)),
                ("reference_number", models.CharField(blank=True, max_length=100)),
                ("paid_to", models.CharField(blank=True, max_length=200)),
                ("academic_year", models.CharField(blank=True, max_length=20)),
                ("term", models.CharField(blank=True, max_length=30)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="expenses", to="finance.expensecategory")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="recorded_expenses", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="expenses", to="school.school")),
                ("vendor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="expenses", to="finance.vendor")),
            ],
            options={"ordering": ["-expense_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="Bill",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("bill_number", models.CharField(max_length=50)),
                ("description", models.TextField(blank=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("amount_paid", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("balance", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("bill_date", models.DateField()),
                ("due_date", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("DRAFT", "Draft"), ("OPEN", "Open"), ("PARTIAL", "Partially paid"), ("PAID", "Paid"), ("CANCELLED", "Cancelled")], default="OPEN", max_length=20)),
                ("academic_year", models.CharField(blank=True, max_length=20)),
                ("term", models.CharField(blank=True, max_length=30)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="bills", to="finance.expensecategory")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_bills", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bills", to="school.school")),
                ("vendor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="bills", to="finance.vendor")),
            ],
            options={"ordering": ["-bill_date", "-created_at"], "unique_together": {("school", "bill_number")}},
        ),
        migrations.CreateModel(
            name="BillPayment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_date", models.DateField()),
                ("payment_method", models.CharField(choices=[("CASH", "Cash"), ("BANK", "Bank transfer"), ("MPESA", "M-Pesa"), ("CHEQUE", "Cheque"), ("OTHER", "Other")], default="BANK", max_length=20)),
                ("reference_number", models.CharField(blank=True, max_length=100)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("bill", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="finance.bill")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="bill_payments_recorded", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bill_payments", to="school.school")),
            ],
            options={"ordering": ["-payment_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="CashLedgerEntry",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("direction", models.CharField(choices=[("IN", "Inflow"), ("OUT", "Outflow")], max_length=3)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("entry_date", models.DateField()),
                ("description", models.CharField(max_length=255)),
                ("reference_number", models.CharField(blank=True, max_length=100)),
                ("source_type", models.CharField(blank=True, max_length=40)),
                ("source_id", models.UUIDField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cash_ledger", to="school.school")),
            ],
            options={"ordering": ["-entry_date", "-created_at"]},
        ),
    ]
