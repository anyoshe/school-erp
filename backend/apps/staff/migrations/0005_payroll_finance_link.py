from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0012_journal_double_entry"),
        ("staff", "0004_hr_complete"),
    ]

    operations = [
        migrations.AddField(
            model_name="payroll",
            name="payment_method",
            field=models.CharField(
                default="BANK",
                help_text="CASH / BANK / MPESA — draws from matching asset account",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="payroll",
            name="paid_from_account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payroll_payments",
                to="finance.account",
            ),
        ),
        migrations.AddField(
            model_name="payroll",
            name="expense",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payroll_rows",
                to="finance.expense",
            ),
        ),
    ]
