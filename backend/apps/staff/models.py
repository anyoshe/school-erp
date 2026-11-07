# staff/models.py
import uuid
from django.db import models
from apps.accounts.models import User
from apps.school.models import School


class Staff(models.Model):
    class Role(models.TextChoices):
        TEACHER = "TEACHER", "Teacher"
        LIBRARIAN = "LIBRARIAN", "Librarian"
        ACCOUNTANT = "ACCOUNTANT", "Accountant"
        PRINCIPAL = "PRINCIPAL", "Principal / Head"
        ADMIN = "ADMIN", "Admin / Office"
        SUPPORT = "SUPPORT", "Support staff"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="staff_profile"
    )
    school = models.ForeignKey(
        School,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="staff_members",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TEACHER)
    department = models.CharField(max_length=80, blank=True, default="")
    job_title = models.CharField(max_length=80, blank=True, default="")
    employee_number = models.CharField(max_length=40, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    hire_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__last_name", "user__first_name", "user__email"]
        indexes = [
            models.Index(fields=["school", "role"]),
            models.Index(fields=["school", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user} ({self.role})"


class Payroll(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="payroll_rows")
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2)
    month = models.DateField()

    class Meta:
        ordering = ["-month"]
