from django.conf import settings
from django.db import models

from apps.school.models import School


class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Asset(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="assets")
    name = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=50, default="Active")  # Active, Damaged, Lost
    location = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.school})"


class ConsumableItem(models.Model):
    """Pantry / supplies stock for ops early-warning (kitchen, cleaning, stationery)."""

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="consumables")
    name = models.CharField(max_length=120)
    unit = models.CharField(max_length=30, default="pcs", help_text="kg, litres, pcs, bags…")
    quantity_on_hand = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Alert when stock is at or below this level",
    )
    expected_daily_use = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Optional planned daily burn; used for waste/anomaly detection",
    )
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("school", "name")

    def __str__(self):
        return f"{self.name} ({self.quantity_on_hand} {self.unit})"


class StockMovement(models.Model):
    class Kind(models.TextChoices):
        IN = "IN", "Received"
        OUT = "OUT", "Issued / used"
        ADJUST = "ADJUST", "Adjustment"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="stock_movements")
    item = models.ForeignKey(ConsumableItem, on_delete=models.CASCADE, related_name="movements")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    movement_date = models.DateField(db_index=True)
    notes = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stock_movements_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-movement_date", "-created_at"]

    def __str__(self):
        return f"{self.kind} {self.quantity} {self.item_id}"
