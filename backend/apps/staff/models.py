# staff/models.py
import uuid
from django.db import models
from apps.accounts.models import User

class Staff(models.Model):
    class Role(models.TextChoices):
        TEACHER = "TEACHER"
        LIBRARIAN = "LIBRARIAN"
        ACCOUNTANT = "ACCOUNTANT"
        PRINCIPAL = "PRINCIPAL"
        OTHER = "OTHER"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    role = models.CharField(max_length=20, choices=Role.choices)
    department = models.CharField(max_length=50, blank=True, null=True)
    hire_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Phase-4-ready school FK
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)


class Payroll(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE)
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2)
    month = models.DateField()
     # Optional: inherit school from staff
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)
