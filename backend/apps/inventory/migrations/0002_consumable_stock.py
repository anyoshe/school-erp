from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("school", "0001_initial"),
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConsumableItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("unit", models.CharField(default="pcs", help_text="kg, litres, pcs, bags…", max_length=30)),
                ("quantity_on_hand", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("reorder_level", models.DecimalField(decimal_places=2, default=0, help_text="Alert when stock is at or below this level", max_digits=12)),
                ("expected_daily_use", models.DecimalField(decimal_places=2, default=0, help_text="Optional planned daily burn; used for waste/anomaly detection", max_digits=12)),
                ("is_active", models.BooleanField(default=True)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="consumables", to="school.school")),
            ],
            options={"ordering": ["name"], "unique_together": {("school", "name")}},
        ),
        migrations.CreateModel(
            name="StockMovement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("IN", "Received"), ("OUT", "Issued / used"), ("ADJUST", "Adjustment")], max_length=10)),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=12)),
                ("movement_date", models.DateField(db_index=True)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movements", to="inventory.consumableitem")),
                ("recorded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="stock_movements_recorded", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stock_movements", to="school.school")),
            ],
            options={"ordering": ["-movement_date", "-created_at"]},
        ),
    ]
