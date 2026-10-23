from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0006_expenses_bills_ledger"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="payment_date",
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="academic_year",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="payment",
            name="term",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="payment",
            name="receipt_number",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AlterModelOptions(
            name="payment",
            options={"ordering": ["-payment_date", "-paid_at"]},
        ),
    ]
