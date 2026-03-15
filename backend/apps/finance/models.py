# finance/models.py
import uuid
from django.db.models import Sum
from django.db.models import F
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator, ValidationError
from django.utils import timezone
from apps.school.models import School
from apps.academics.models import GradeLevel  # For class-specific structures

User = settings.AUTH_USER_MODEL


class FeeCategory(models.Model):
    """
    Fee groups (e.g. Academic, Boarding, Miscellaneous)
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="fee_categories")
    name = models.CharField(max_length=100)  # e.g. "Academic Fees", "Boarding Fees"
    description = models.TextField(blank=True)
    is_mandatory = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "name"]
        unique_together = ["school", "name"]

    def __str__(self):
        return f"{self.name} ({self.school.name})"


class FeeItem(models.Model):
    """
    Individual fee lines (e.g. Tuition, Boarding, Lunch, Admission, Caution Money, Motivation Fee, Building Fee, Textbooks, Computer Fee)
    """
    category = models.ForeignKey(FeeCategory, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=150)  # e.g. "Term 1 Tuition", "Lunch Fee", "Caution Money"
    description = models.TextField(blank=True)


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
    is_statutory = models.BooleanField(default=False, help_text="e.g. KNEC exam fees, government levies")

    # Assignment flexibility
    grade_levels = models.ManyToManyField(GradeLevel, blank=True, related_name="applicable_fee_items")
    
    is_optional = models.BooleanField(default=False)
    # Future: gender, boarding_only, etc.

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.category.name})"

class FeeStructure(models.Model):

    PERIOD_TYPES = [
        ("term", "Term"),
        ("semester", "Semester"),
        ("monthly", "Monthly"),
        ("full_year", "Full Year"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="fee_structures")

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    grade_level = models.ForeignKey(
        GradeLevel,
        on_delete=models.CASCADE,
        related_name="fee_structures"
    )

    academic_year = models.CharField(max_length=9, default="2026")
    billing_period_type = models.CharField(
        max_length=20,
        choices=PERIOD_TYPES,
        default="term"
    )
    period_name = models.CharField(
        max_length=50, 
        help_text="e.g. Term 1, Semester 2, etc.",
        default="Term 1"
    )

    is_active = models.BooleanField(default=True)
    available_optional_items = models.ManyToManyField(
        FeeItem, 
        blank=True, 
        related_name="available_in_structures",
        limit_choices_to={'is_optional': True},
        help_text="Optional items that can be added to this structure during enrollment"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["school", "grade_level", 'billing_period_type', 'period_name', "academic_year"]
        ordering = ["-academic_year", "grade_level", "period_name"]

    @property
    def total_amount(self):
        return (
            self.structure_items.aggregate(
                total=models.Sum("amount")
            )["total"]
            or 0
        )


class FeeStructureItem(models.Model):
    """
    Price of a fee item within a specific structure
    """
    structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.CASCADE,
        related_name="structure_items"
    )

    item = models.ForeignKey(
        FeeItem,
        on_delete=models.CASCADE,
        related_name="structure_prices"
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ["structure", "item"]
        indexes = [
            models.Index(fields=["structure"]),
        ]

    def __str__(self):
        return f"{self.structure.name} - {self.item.name} ({self.amount})"

class PaymentPlan(models.Model):
    PLAN_TYPES = [
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
        ("termly", "Termly"),
        ("semester", "Semester"),
        ("full", "Full Payment"),
        ("custom", "Custom/Partial"),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPES)
    number_of_installments = models.IntegerField(default=1)
    # How many days between each payment? (7 for weekly, 30 for monthly)
    days_interval = models.IntegerField(default=30) 
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.plan_type})"

class PaymentPlanInstallment(models.Model):

    plan = models.ForeignKey(
        PaymentPlan,
        on_delete=models.CASCADE,
        related_name="installments"
    )

    name = models.CharField(max_length=50)

    percentage = models.DecimalField(max_digits=5, decimal_places=2)

    order = models.IntegerField()

    days_after_start = models.IntegerField()

    def clean(self):
        # We need to exclude the current instance if it's an update
        others = PaymentPlanInstallment.objects.filter(plan=self.plan)
        if self.pk:
            others = others.exclude(pk=self.pk)
        
        total = others.aggregate(total=models.Sum("percentage"))["total"] or 0
        if total + self.percentage > 100:
            raise ValidationError(f"Total percentage would be {total + self.percentage}%, which exceeds 100%.")
class StudentFeeAssignment(models.Model):
    """
    Personalized fee assignment to a student (links structure + overrides/waivers)
    """
    student = models.OneToOneField('students.Student', on_delete=models.CASCADE, related_name="fee_assignment")
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.SET_NULL, null=True, blank=True)
    waiver_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    waiver_reason = models.CharField(max_length=255, blank=True)
    is_waived = models.BooleanField(default=False)
    payment_plan = models.ForeignKey(
        PaymentPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    assigned_at = models.DateField(auto_now_add=True)
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="fee_assignments")
    selected_optional_items = models.ManyToManyField(
        FeeItem,
        blank=True,
        related_name="assigned_students"
    )

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.student.full_name} - {self.fee_structure.name if self.fee_structure else 'Custom'}"

    @property
    def effective_total(self):
        base_total = self.fee_structure.total_amount if self.fee_structure else 0
        # Add the cost of optional items
        optional_total = sum(
            FeeStructureItem.objects.filter(
                structure=self.fee_structure, 
                item=item
            ).first().amount or 0 
            for item in self.selected_optional_items.all()
        )
        return max(0, base_total + optional_total - self.waiver_amount)


class Invoice(models.Model):
    """
    Generated bill for a student per term/year
    """
    school = models.ForeignKey('school.School', on_delete=models.CASCADE, null=True, blank=True)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name="invoices")
    fee_assignment = models.ForeignKey(StudentFeeAssignment, on_delete=models.CASCADE, related_name="invoices")
    installment = models.ForeignKey(
        PaymentPlanInstallment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    installment_number = models.PositiveIntegerField(default=1)
    payment_plan = models.ForeignKey(PaymentPlan, on_delete=models.SET_NULL, null=True, blank=True)
    due_date = models.DateField()
    term = models.CharField(max_length=20)  # "Term 1", "Term 2", "Full Year"
    academic_year = models.CharField(max_length=9)  # "2026"
    invoice_number = models.CharField(max_length=50, unique=True)  # Auto-generated
    amount_due = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="generated_invoices")
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    late_fee_applied = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def current_total_due(self):
        # amount_due + any penalties
        return self.amount_due + self.late_fee_applied

    def save(self, *args, **kwargs):
        # Update balance based on current total
        self.balance = (self.amount_due + self.late_fee_applied) - self.amount_paid

    class Meta:
        ordering = ["-generated_at"]
        # unique_together = ["student", "term", "academic_year"]
        unique_together = ["student", "fee_assignment", "installment_number"]

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.student.full_name} ({self.term})"

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = self.generate_invoice_number()
        self.balance = self.amount_due - self.amount_paid
        self.is_paid = self.balance <= 0
        if self.is_paid and not self.paid_at:
            self.paid_at = timezone.now()
        super().save(*args, **kwargs)

    def generate_invoice_number(self):
        """Auto-generate invoice number"""
        year = self.academic_year[-2:]  # 26 for 2026
        seq = Invoice.objects.filter(
            student__school=self.student.school,
            academic_year=self.academic_year,
            term=self.term
        ).count() + 1
        return f"INV-{self.student.school.admission_prefix or 'SCH'}-{year}-{self.term[:2].upper()}-{seq:04d}"
class InvoiceLine(models.Model):

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="lines"
    )
    item = models.ForeignKey(
        FeeItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    description = models.CharField(max_length=200)

    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.description}"

class Payment(models.Model):
    """
    Payment records against invoices
    """
    school = models.ForeignKey('school.School', on_delete=models.CASCADE, null=True, blank=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=50,
        choices=[
            ('CASH', 'Cash'),
            ('M-PESA', 'M-PESA'),
            ('BANK', 'Bank Transfer'),
            ('CHEQUE', 'Cheque'),
            ('WAIVER', 'Waiver'),
            ('SCHOLARSHIP', 'Scholarship'),
        ],
        default='CASH'
    )
    reference_number = models.CharField(max_length=100, blank=True)  # Receipt/MPESA code
    paid_at = models.DateTimeField(auto_now_add=True)
    paid_by = models.ForeignKey('students.StudentGuardian', on_delete=models.SET_NULL, null=True, blank=True, related_name="payments")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-paid_at"]

    def __str__(self):
        return f"Payment {self.amount} - {self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        if self.amount < 0:
            raise ValidationError("Payment amount cannot be negative.")
        super().save(*args, **kwargs)

        # Update invoice
        # self.invoice.amount_paid += self.amount
        # self.invoice.save()

        Invoice.objects.filter(id=self.invoice.id).update(
        amount_paid=F('amount_paid') + self.amount
        )
class LateFeeRule(models.Model):

    school = models.ForeignKey(School, on_delete=models.CASCADE)

    days_after_due = models.IntegerField()

    penalty_amount = models.DecimalField(max_digits=12, decimal_places=2)