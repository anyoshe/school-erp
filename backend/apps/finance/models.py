# # finance/models.py
# import uuid
# from django.db import models
# from apps.students.models import Student
# from apps.academics.models import Class

# class FeeStructure(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     class_fk = models.ForeignKey(Class, on_delete=models.CASCADE)
#     term = models.CharField(max_length=20)
#     amount = models.DecimalField(max_digits=10, decimal_places=2)
#     # Phase-4-ready school FK
#     # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)

# class StudentLedger(models.Model):
#     class TransactionType(models.TextChoices):
#         CHARGE = "CHARGE"
#         PAYMENT = "PAYMENT"

#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     student = models.ForeignKey(Student, on_delete=models.CASCADE)
#     transaction_type = models.CharField(max_length=10, choices=TransactionType.choices)
#     amount = models.DecimalField(max_digits=10, decimal_places=2)
#     balance_after = models.DecimalField(max_digits=10, decimal_places=2)
#     date = models.DateField()
#     reference = models.CharField(max_length=100, blank=True, null=True)
#     # Phase-4-ready school FK
#     # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)

# class Payment(models.Model):
#     class PaymentMethod(models.TextChoices):
#         CASH = "CASH"
#         CARD = "CARD"
#         BANK_TRANSFER = "BANK_TRANSFER"

#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     student = models.ForeignKey(Student, on_delete=models.CASCADE)
#     amount = models.DecimalField(max_digits=10, decimal_places=2)
#     payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
#     reference = models.CharField(max_length=100, blank=True, null=True)
#     created_at = models.DateTimeField(auto_now_add=True)
#      # Phase-4-ready school FK
#     # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)

# finance/models.py
from django.db import models
from apps.school.models import School
from apps.academics.models import GradeLevel, Department


class FeeCategory(models.Model):
    """
    Groups of fees (Tuition, Admission, Uniform, Exam, Activity, etc.)
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="fee_categories")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_mandatory = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "name"]
        unique_together = ["school", "name"]

    def __str__(self):
        return self.name


class FeeItem(models.Model):
    """
    Individual fee lines that can be assigned to specific classes/streams
    """
    category = models.ForeignKey(FeeCategory, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=150)  # "Term 1 Tuition", "Registration Fee"

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="KES")  # allow override

    frequency = models.CharField(
        max_length=30,
        choices=[
            ("per_term", "Per Term"),
            ("per_year", "Per Year"),
            ("one_time", "One-time"),
            ("monthly", "Monthly"),
        ],
        default="per_term",
    )

    is_active = models.BooleanField(default=True)

    # Who it applies to
    grade_levels = models.ManyToManyField(GradeLevel, blank=True, related_name="applicable_fees")
    departments = models.ManyToManyField(Department, blank=True, related_name="applicable_fees")

    # Future extension points
    # boarding_only = models.BooleanField(default=False)
    # gender = models.CharField(max_length=10, blank=True)  # M/F/Both

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} - {self.amount} {self.currency}"