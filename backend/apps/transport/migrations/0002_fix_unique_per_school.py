# Generated manually for multi-tenant uniqueness fix

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0001_initial'),
        ('school', '0003_schoolsupportsession_one_active_school_support_per_admin'),
    ]

    operations = [
        migrations.AlterField(
            model_name='vehicle',
            name='registration_number',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name='driver',
            name='license_number',
            field=models.CharField(max_length=50),
        ),
        migrations.AddConstraint(
            model_name='vehicle',
            constraint=models.UniqueConstraint(
                fields=('school', 'registration_number'),
                name='unique_vehicle_reg_per_school',
            ),
        ),
        migrations.AddConstraint(
            model_name='driver',
            constraint=models.UniqueConstraint(
                fields=('school', 'license_number'),
                name='unique_driver_license_per_school',
            ),
        ),
    ]
