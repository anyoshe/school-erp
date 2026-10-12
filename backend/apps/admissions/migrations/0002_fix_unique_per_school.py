# Generated manually for multi-tenant uniqueness fix

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admissions', '0001_initial'),
        ('school', '0003_schoolsupportsession_one_active_school_support_per_admin'),
    ]

    operations = [
        migrations.AlterField(
            model_name='application',
            name='admission_number',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddConstraint(
            model_name='application',
            constraint=models.UniqueConstraint(
                condition=models.Q(('admission_number__isnull', False)),
                fields=('school', 'admission_number'),
                name='unique_admission_number_per_school',
            ),
        ),
    ]
