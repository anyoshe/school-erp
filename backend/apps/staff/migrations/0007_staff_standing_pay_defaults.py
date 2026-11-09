from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0006_payroll_fee_expense_category"),
    ]

    operations = [
        migrations.AddField(
            model_name="staff",
            name="default_basic_salary",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Standing basic pay copied into each month's payslip",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="staff",
            name="default_allowances",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=12),
        ),
        migrations.AddField(
            model_name="staff",
            name="default_deductions",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=12),
        ),
        migrations.AddField(
            model_name="staff",
            name="default_fee_category",
            field=models.ForeignKey(
                blank=True,
                help_text="Fee group this staff is usually paid from (e.g. Tuition, ICT)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="staff_default_funding",
                to="finance.feecategory",
            ),
        ),
        migrations.AddField(
            model_name="staff",
            name="default_expense_category",
            field=models.ForeignKey(
                blank=True,
                help_text="Expense class (Salaries, Administration, Security, …)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="staff_default_expense",
                to="finance.expensecategory",
            ),
        ),
    ]
