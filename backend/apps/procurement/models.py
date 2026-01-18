from django.db import models
from apps.school.models import School


class Vendor(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='vendors')
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    kra_pin = models.CharField(max_length=50, blank=True)  # Kenyan-specific
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Tender(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='tenders')
    title = models.CharField(max_length=255)
    description = models.TextField()
    reference_number = models.CharField(max_length=100, unique=True)
    opening_date = models.DateField()
    closing_date = models.DateField()
    status = models.CharField(max_length=50, default='Open')  # Open, Closed, Awarded
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class PurchaseOrder(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='purchase_orders')
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True)
    tender = models.ForeignKey(Tender, on_delete=models.SET_NULL, null=True, blank=True)
    order_number = models.CharField(max_length=100, unique=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    order_date = models.DateField(auto_now_add=True)
    expected_delivery = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Pending')  # Pending, Delivered, Cancelled

    def __str__(self):
        return f"PO #{self.order_number}"