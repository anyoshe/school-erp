
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0007_payment_date_term_receipt"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="line_allocations",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
