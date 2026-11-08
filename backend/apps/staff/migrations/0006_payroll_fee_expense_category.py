from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0012_journal_double_entry"),
        ("staff", "0005_payroll_finance_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="payroll",
            name="related_fee_category",
            field=models.ForeignKey(
                blank=True,
                help_text="Fee group this salary is charged against (e.g. Tuition, ICT).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payroll_allocations",
                to="finance.feecategory",
            ),
        ),
        migrations.AddField(
            model_name="payroll",
            name="expense_category",
            field=models.ForeignKey(
                blank=True,
                help_text="Expense category for reporting (defaults to Staff salaries).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payroll_rows",
                to="finance.expensecategory",
            ),
        ),
    ]
