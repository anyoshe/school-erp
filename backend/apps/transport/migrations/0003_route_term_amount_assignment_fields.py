from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("transport", "0002_fix_unique_per_school"),
    ]

    operations = [
        migrations.AddField(
            model_name="route",
            name="term_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="route",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="route",
            name="sort_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="studentassignment",
            name="academic_year",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="studentassignment",
            name="term",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="studentassignment",
            name="amount_override",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True
            ),
        ),
        migrations.AddField(
            model_name="studentassignment",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="studentassignment",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name="studentassignment",
            name="notes",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="route",
            name="distance_km",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=8, null=True
            ),
        ),
        migrations.AlterField(
            model_name="vehicle",
            name="make_model",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AlterField(
            model_name="vehicle",
            name="capacity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="driver",
            name="license_number",
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
