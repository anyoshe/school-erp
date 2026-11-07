from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0010_require_fee_structure_period"),
    ]

    operations = [
        migrations.AddField(
            model_name="expense",
            name="paid_from_account",
            field=models.ForeignKey(
                blank=True,
                help_text="Asset account the payment is drawn from (cash, bank, M-Pesa).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="expenses_paid",
                to="finance.account",
            ),
        ),
        migrations.AddField(
            model_name="expense",
            name="related_fee_category",
            field=models.ForeignKey(
                blank=True,
                help_text="Fee group this expense is associated with (e.g. Transport for fuel).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="related_expenses",
                to="finance.feecategory",
            ),
        ),
        migrations.AddField(
            model_name="expense",
            name="related_fee_item",
            field=models.ForeignKey(
                blank=True,
                help_text="Optional specific fee item this expense relates to.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="related_expenses",
                to="finance.feeitem",
            ),
        ),
    ]
