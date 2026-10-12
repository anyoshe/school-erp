# Generated manually for multi-tenant uniqueness fix

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0001_initial'),
        ('school', '0003_schoolsupportsession_one_active_school_support_per_admin'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tender',
            name='reference_number',
            field=models.CharField(max_length=100),
        ),
        migrations.AlterField(
            model_name='purchaseorder',
            name='order_number',
            field=models.CharField(max_length=100),
        ),
        migrations.AddConstraint(
            model_name='tender',
            constraint=models.UniqueConstraint(
                fields=('school', 'reference_number'),
                name='unique_tender_reference_per_school',
            ),
        ),
        migrations.AddConstraint(
            model_name='purchaseorder',
            constraint=models.UniqueConstraint(
                fields=('school', 'order_number'),
                name='unique_po_number_per_school',
            ),
        ),
    ]
