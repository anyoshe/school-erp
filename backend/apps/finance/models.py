# finance/models.py
from decimal import Decimal
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

    academic_year = models.CharField(max_length=9)
    billing_period_type = models.CharField(
        max_length=20,
        choices=PERIOD_TYPES,
        default="term"
    )
    period_name = models.CharField(
        max_length=50, 
        help_text="e.g. Term 1, Semester 2, etc.",
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
        """Total of ALL items in the structure (mandatory + all optional)"""
        return self.structure_items.aggregate(
            total=Sum("amount")
        )["total"] or Decimal('0')

    @property
    def mandatory_total(self):
        """Mandatory lines only — optional items excluded until selected at clearance."""
        total = Decimal("0")
        for si in self.structure_items.select_related("item").all():
            item = si.item
            if item is None:
                continue
            if getattr(item, "is_optional", False):
                continue
            total += Decimal(str(si.amount or 0))
        return total


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
    # Add these fields to your existing PaymentPlan model

    description = models.TextField(blank=True, 
        help_text="Shown to parents in the enrollment wizard")
    
    is_recommended = models.BooleanField(default=False, 
        help_text="Highlight this plan in the frontend dropdown")
    
    # Optional: Allow different first installment (e.g. 40% down, then equal rest)
    first_installment_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="0 = equal installments. Example: 30 means first payment is 30% of balance"
    )

    # Future-proof field
    notes = models.TextField(blank=True)

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
    custom_due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Due date for the remaining balance when using a custom/partial payment plan"
    )
    assigned_at = models.DateField(auto_now_add=True)
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="fee_assignments")
    selected_optional_items = models.ManyToManyField(
        FeeItem,
        blank=True,
        related_name="assigned_students"
    )

    item_amounts = models.JSONField(
        default=dict,
        blank=True,
        help_text="Deposit allocation amounts for each fee item within this assignment. Keys are FeeItem IDs."
    )

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.student.full_name} - {self.fee_structure.name if self.fee_structure else 'Custom'}"

    def get_assignment_items(self):
        """Return the line items that make up this fee assignment, including deposit allocations."""
        if not self.fee_structure:
            return []

        structure_items = self.fee_structure.structure_items.select_related('item__category').all()
        optional_item_ids = set(self.fee_structure.available_optional_items.values_list('id', flat=True))

        admission_item_ids = {
            si.item_id for si in structure_items
            if 'admission' in (getattr(si.item.category, 'name', '') or '').strip().lower()
        }

        selected_optional_ids = set(self.selected_optional_items.values_list('id', flat=True))
        deposit_allocations = {str(k): Decimal(str(v)) for k, v in (self.item_amounts or {}).items()}

        # Apply waiver proportionally across admission items, then allocate deposits
        admission_items = [si for si in structure_items if si.item_id in admission_item_ids]
        admission_total = sum(si.amount for si in admission_items)
        waiver_remaining = Decimal(str(self.waiver_amount or 0)) if self.is_waived else Decimal('0')

        admission_net_by_item = {}
        for si in admission_items:
            if admission_total > 0 and waiver_remaining > 0:
                share = si.amount / admission_total
                item_waiver = (waiver_remaining * share).quantize(Decimal('0.01'))
            else:
                item_waiver = Decimal('0')
            admission_net_by_item[si.item_id] = max(Decimal('0'), si.amount - item_waiver)

        items = []
        for si in structure_items:
            item = si.item
            item_id = item.id
            # Optional if flagged on the fee item OR listed on the structure's optional set
            is_optional = (
                item_id not in admission_item_ids
                and (
                    bool(getattr(item, "is_optional", False))
                    or item_id in optional_item_ids
                )
            )
            include_item = (not is_optional) or (item_id in selected_optional_ids)
            if not include_item:
                continue

            cost = admission_net_by_item.get(item_id, si.amount)
            allocated = min(deposit_allocations.get(str(item_id), Decimal('0')), cost)
            remaining = max(Decimal('0'), cost - allocated)

            items.append({
                'item': item,
                'item_id': item_id,
                'description': item.name,
                'category': item.category.name,
                'cost': cost,
                'deposit_allocated': allocated,
                'remaining_amount': remaining,
                'is_optional': is_optional,
                'is_admission': item_id in admission_item_ids,
            })

        def sort_key(entry):
            desc = entry['description'].lower()
            if 'tuition' in desc:
                return (1, entry['category'], entry['description'])
            return (0, entry['category'], entry['description'])

        return sorted(items, key=sort_key)

    @property
    def assigned_total(self):
        if not self.fee_structure:
            return Decimal('0')

        total = sum(entry['cost'] for entry in self.get_assignment_items())
        return max(Decimal('0'), total)

    @property
    def remaining_total(self):
        if not self.fee_structure:
            return Decimal('0')

        total = sum(entry['remaining_amount'] for entry in self.get_assignment_items())
        return max(Decimal('0'), total)

    @property
    def effective_total(self):
        return self.assigned_total


class Invoice(models.Model):
    """
    Generated bill for a student per term/year
    """
    school = models.ForeignKey(
        'school.School',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="invoices",
        help_text="Denormalized from student.school; always set on save.",
    )
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
    invoice_number = models.CharField(max_length=50)  # unique per school via constraint
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

    class Meta:
        ordering = ["-generated_at"]
        unique_together = ["student", "fee_assignment", "installment_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "invoice_number"],
                name="finance_invoice_unique_number_per_school",
            ),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.student.full_name} ({self.term})"

    def save(self, *args, **kwargs):
        # Always keep tenant school in sync with the student
        if self.student_id and (not self.school_id or self.school_id != self.student.school_id):
            self.school_id = self.student.school_id
        if not self.invoice_number:
            self.invoice_number = self.generate_invoice_number()
        self.balance = max(Decimal('0'), self.current_total_due - self.amount_paid)
        self.is_paid = self.amount_paid >= self.current_total_due
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
    # Clearance adjustments (scholarship / parent status)
    original_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Billed amount before waive/discount",
    )
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_waived = models.BooleanField(default=False)
    adjustment_reason = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.description}"

    def billed_base(self):
        from decimal import Decimal
        if self.original_amount is not None:
            return Decimal(str(self.original_amount))
        return Decimal(str(self.amount or 0))

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
            ('TRANSFER', 'Balance transfer'),
        ],
        default='CASH'
    )
    reference_number = models.CharField(max_length=100, blank=True)  # Receipt/MPESA code
    # Business date of the receipt (required for backdating / term allocation)
    payment_date = models.DateField(null=True, blank=True, db_index=True)
    academic_year = models.CharField(max_length=20, blank=True)
    term = models.CharField(max_length=50, blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)
    paid_by = models.ForeignKey('students.StudentGuardian', on_delete=models.SET_NULL, null=True, blank=True, related_name="payments")
    notes = models.TextField(blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)
    # How this payment was allocated across invoice lines (cashier choice)
    # [{"line_id": "...", "description": "...", "amount": 100.0}, ...]
    line_allocations = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-payment_date", "-paid_at"]

    def __str__(self):
        return f"Payment {self.amount} - {self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        if self.amount < 0:
            raise ValidationError("Payment amount cannot be negative.")

        # Tenant denormalization from invoice / student
        if self.invoice_id:
            inv = self.invoice
            school_id = inv.school_id or (inv.student.school_id if inv.student_id else None)
            if school_id and self.school_id != school_id:
                self.school_id = school_id

        is_new = self._state.adding
        if not self.payment_date:
            from django.utils import timezone as dj_tz
            self.payment_date = dj_tz.now().date()
        if self.invoice_id:
            inv = self.invoice
            if not self.academic_year and getattr(inv, "academic_year", None):
                self.academic_year = inv.academic_year or ""
            if not self.term and getattr(inv, "term", None):
                self.term = inv.term or ""
        if is_new and not self.receipt_number:
            from django.utils import timezone as dj_tz
            prefix = "RCPT"
            self.receipt_number = f"{prefix}-{dj_tz.now().strftime('%Y%m%d%H%M%S')}-{str(self.invoice_id)[:6]}"

        super().save(*args, **kwargs)

        if is_new:
            # Apply this payment to the linked invoice and refresh balance/status
            Invoice.objects.filter(id=self.invoice_id).update(
                amount_paid=F('amount_paid') + self.amount
            )
            self.invoice.refresh_from_db(fields=['amount_paid', 'amount_due', 'late_fee_applied'])
            self.invoice.save(update_fields=['balance', 'is_paid', 'paid_at', 'school'])

            # Finance clearance: first school-fee payment activates the student
            try:
                student = getattr(self.invoice, "student", None)
                if student is not None and getattr(student, "status", None) == "PENDING_CLEARANCE":
                    student.status = "ACTIVE"
                    student.save(update_fields=["status"])
            except Exception:
                pass
class LateFeeRule(models.Model):

    school = models.ForeignKey(School, on_delete=models.CASCADE)

    days_after_due = models.IntegerField()

    penalty_amount = models.DecimalField(max_digits=12, decimal_places=2)


class Account(models.Model):
    """Lightweight chart of accounts per school (income / cash foundation)."""

    class AccountType(models.TextChoices):
        INCOME = "INCOME", "Income"
        ASSET = "ASSET", "Asset"
        LIABILITY = "LIABILITY", "Liability"
        EXPENSE = "EXPENSE", "Expense"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="accounts")
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=120)
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("school", "code")]
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} {self.name}"


class IncomeReceipt(models.Model):
    """
    Pre-enrollment / one-time income (interview, admission) posted to finance
    without requiring a term fee invoice.
    """

    class Source(models.TextChoices):
        INTERVIEW = "INTERVIEW", "Interview fee"
        ADMISSION = "ADMISSION", "Admission / registration fee"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="income_receipts")
    account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name="income_receipts"
    )
    application_id = models.UUIDField(null=True, blank=True, db_index=True)
    student = models.ForeignKey(
        "students.Student", on_delete=models.SET_NULL, null=True, blank=True, related_name="income_receipts"
    )
    source = models.CharField(max_length=20, choices=Source.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=50, blank=True, default="CASH")
    reference_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)
    charge_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-paid_at"]

    def __str__(self):
        return f"{self.source} {self.amount} ({self.school_id})"


class ExpenseCategory(models.Model):
    """Operating expense categories (utilities, salaries, supplies, etc.)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="expense_categories")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("school", "name")]

    def __str__(self):
        return self.name


class Vendor(models.Model):
    """Suppliers / payees for bills and expenses."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="finance_vendors")
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("school", "name")]

    def __str__(self):
        return self.name


class Expense(models.Model):
    """School operating expense (money out)."""
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank transfer"
        MPESA = "MPESA", "M-Pesa"
        CHEQUE = "CHEQUE", "Cheque"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="expenses")
    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses"
    )
    vendor = models.ForeignKey(
        Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses"
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    reference_number = models.CharField(max_length=100, blank=True)
    paid_to = models.CharField(max_length=200, blank=True, help_text="Payee name if no vendor")
    academic_year = models.CharField(max_length=20, blank=True)
    term = models.CharField(max_length=30, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="recorded_expenses"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-created_at"]

    def __str__(self):
        return f"{self.title} ({self.amount})"


class Bill(models.Model):
    """Vendor bill / payable (school owes supplier)."""
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        OPEN = "OPEN", "Open"
        PARTIAL = "PARTIAL", "Partially paid"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="bills")
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="bills")
    bill_number = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bill_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="bills"
    )
    academic_year = models.CharField(max_length=20, blank=True)
    term = models.CharField(max_length=30, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_bills"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-bill_date", "-created_at"]
        unique_together = [("school", "bill_number")]

    def __str__(self):
        return f"{self.bill_number} — {self.vendor}"

    def refresh_payment_state(self):
        paid = self.payments.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        self.amount_paid = paid
        self.balance = max(Decimal("0"), Decimal(str(self.amount)) - paid)
        if self.balance <= 0:
            self.status = self.Status.PAID
            self.balance = Decimal("0")
        elif paid > 0:
            self.status = self.Status.PARTIAL
        elif self.status not in (self.Status.CANCELLED, self.Status.DRAFT):
            self.status = self.Status.OPEN
        self.save(update_fields=["amount_paid", "balance", "status", "updated_at"])


class BillPayment(models.Model):
    """Payment against a vendor bill."""
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank transfer"
        MPESA = "MPESA", "M-Pesa"
        CHEQUE = "CHEQUE", "Cheque"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="bill_payments")
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.BANK)
    reference_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="bill_payments_recorded"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-created_at"]


class CashLedgerEntry(models.Model):
    """Simple cash/bank movement log for school standing."""
    class Direction(models.TextChoices):
        IN = "IN", "Inflow"
        OUT = "OUT", "Outflow"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="cash_ledger")
    direction = models.CharField(max_length=3, choices=Direction.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    entry_date = models.DateField()
    description = models.CharField(max_length=255)
    reference_number = models.CharField(max_length=100, blank=True)
    source_type = models.CharField(max_length=40, blank=True)
    source_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-entry_date", "-created_at"]
