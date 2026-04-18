# Generated manually to add item_amounts to StudentFeeAssignment

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0012_studentfeeassignment_custom_due_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentfeeassignment',
            name='item_amounts',
            field=models.JSONField(blank=True, default=dict, help_text='Override amounts for each fee item within this assignment. Keys are FeeItem IDs.'),
        ),
    ]
