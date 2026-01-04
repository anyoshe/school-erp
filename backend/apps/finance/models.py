# finance/models.py
import uuid
from django.db import models
from apps.students.models import Student
from apps.academics.models import Class

class FeeStructure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_fk = models.ForeignKey(Class, on_delete=models.CASCADE)
    term = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    # Phase-4-ready school FK
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)

class StudentLedger(models.Model):
    class TransactionType(models.TextChoices):
        CHARGE = "CHARGE"
        PAYMENT = "PAYMENT"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    transaction_type = models.CharField(max_length=10, choices=TransactionType.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    reference = models.CharField(max_length=100, blank=True, null=True)
    # Phase-4-ready school FK
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)

class Payment(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH"
        CARD = "CARD"
        BANK_TRANSFER = "BANK_TRANSFER"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    reference = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
     # Phase-4-ready school FK
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)
