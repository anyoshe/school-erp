# staff/models.py
import uuid
from decimal import Decimal
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

    class EmploymentType(models.TextChoices):
        PERMANENT = "PERMANENT", "Permanent"
        CONTRACT = "CONTRACT", "Contract"
        PART_TIME = "PART_TIME", "Part-time"
        TEMPORARY = "TEMPORARY", "Temporary"
        INTERN = "INTERN", "Intern / Volunteer"

    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
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
    exit_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True, default="")

    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.PERMANENT,
    )
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, default="")
    national_id = models.CharField(max_length=40, blank=True, default="", verbose_name="National ID")
    tsc_number = models.CharField(max_length=40, blank=True, default="", verbose_name="TSC number")
    bank_name = models.CharField(max_length=80, blank=True, default="")
    bank_account = models.CharField(max_length=40, blank=True, default="")
    next_of_kin = models.CharField(max_length=120, blank=True, default="")
    next_of_kin_phone = models.CharField(max_length=30, blank=True, default="")

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
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        APPROVED = "APPROVED", "Approved"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="payroll_rows")
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    net_salary = models.DecimalField(max_digits=12, decimal_places=2)
    month = models.DateField(help_text="Use first day of the pay month")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    paid_at = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default="")
    payment_method = models.CharField(
        max_length=20,
        default="BANK",
        help_text="CASH / BANK / MPESA — draws from matching asset account",
    )
    paid_from_account = models.ForeignKey(
        "finance.Account",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payroll_payments",
    )
    expense = models.ForeignKey(
        "finance.Expense",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payroll_rows",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-month", "staff__user__last_name"]
        unique_together = ("staff", "month")

    def recalculate_net(self):
        self.net_salary = (
            (self.basic_salary or Decimal("0"))
            + (self.allowances or Decimal("0"))
            - (self.deductions or Decimal("0"))
        )
        return self.net_salary

    def save(self, *args, **kwargs):
        self.recalculate_net()
        super().save(*args, **kwargs)


class LeaveRequest(models.Model):
    class LeaveType(models.TextChoices):
        ANNUAL = "ANNUAL", "Annual leave"
        SICK = "SICK", "Sick leave"
        MATERNITY = "MATERNITY", "Maternity"
        PATERNITY = "PATERNITY", "Paternity"
        COMPASSIONATE = "COMPASSIONATE", "Compassionate"
        UNPAID = "UNPAID", "Unpaid"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="leave_requests")
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.CharField(max_length=20, choices=LeaveType.choices, default=LeaveType.ANNUAL)
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.PositiveIntegerField(default=1)
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_reviews",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def __str__(self):
        return f"{self.staff_id} {self.leave_type} {self.start_date}"
