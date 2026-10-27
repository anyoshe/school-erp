# Generated manually for clearance line waive/discount
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0008_auto" if False else "0009_auto"),
    ]

    operations = [
        migrations.AddField(
            model_name="invoiceline",
            name="original_amount",
            field=models.DecimalField(blank=True, decimal_places=2, help_text="Billed amount before waive/discount", max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="invoiceline",
            name="discount_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="invoiceline",
            name="is_waived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="invoiceline",
            name="adjustment_reason",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
