# students/models.py
import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal
from apps.accounts.models import User  # Assuming custom User
from apps.school.models import School  # Multi-tenancy
from apps.academics.models import GradeLevel  # For current_class

User = settings.AUTH_USER_MODEL

class Student(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        GRADUATED = "GRADUATED", "Graduated"
        TRANSFERRED = "TRANSFERRED", "Transferred"
        SUSPENDED = "SUSPENDED", "Suspended"
        EXPELLED = "EXPELLED", "Expelled"

    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Multi-tenancy
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='students')

    # Identification (mirrors Application)
    admission_number = models.CharField(max_length=50, unique=True)
    learner_id = models.CharField(max_length=50, blank=True, verbose_name="Learner ID / National Student ID")
    entry_exam_id = models.CharField(max_length=50, blank=True, verbose_name="Entry / National Exam ID")
    entry_exam_year = models.PositiveIntegerField(null=True, blank=True)

    # Personal Info (mirrors Application)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    preferred_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    religion = models.CharField(max_length=50, blank=True)
    photo = models.ImageField(upload_to='student_photos/', null=True, blank=True)

    # Additional Personal Info
    birth_certificate_number = models.CharField(max_length=50, blank=True, verbose_name="Birth Certificate Number")
    passport_number = models.CharField(max_length=50, blank=True, verbose_name="Passport Number (non-Kenyan)")
    previous_school = models.CharField(max_length=255, blank=True, verbose_name="Previous School Name & Address")
    previous_grade = models.CharField(max_length=50, blank=True, verbose_name="Previous Grade/Class")
    disability_type = models.CharField(max_length=100, blank=True, verbose_name="Disability Type")
    special_needs_category = models.CharField(max_length=100, blank=True, verbose_name="Special Needs Category")
    transport_mode = models.CharField(
        max_length=50,
        choices=[("walking", "Walking"), ("private", "Private/Parent"), ("school_bus", "School Bus"), ("public", "Public Transport")],
        default="walking"
    )
    transport_route = models.CharField(max_length=100, blank=True, verbose_name="Bus Route/Stop")
    sponsor_name = models.CharField(max_length=150, blank=True, verbose_name="Sponsor / Bursary Organization")

    # Address (mirrors Application)
    address = models.TextField(blank=True)
    region = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)

    # Academic Info (partly mirrored, partly operational)
    current_class = models.ForeignKey(
        GradeLevel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students'
    )
    section = models.CharField(max_length=50, blank=True)               # A, B, C... or longer section names
    stream = models.CharField(max_length=50, blank=True)                # Science, Arts...
    house = models.CharField(max_length=50, blank=True)                 # Red House, etc.
    boarding_status = models.CharField(
        max_length=20,
        choices=[('DAY', 'Day'), ('BOARDING', 'Boarding'), ('MIXED', 'Mixed')],
        default='DAY'
    )
    dorm_room = models.CharField(max_length=20, blank=True)

    # Health & Emergency (mirrors Application + extras)
    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    disability = models.CharField(max_length=100, blank=True)
    vaccination_status = models.CharField(
        max_length=20,
        choices=[
            ("UP_TO_DATE", "Up to date"),
            ("PARTIAL", "Partial"),
            ("NOT_IMMUNIZED", "Not immunized"),
            ("UNKNOWN", "Unknown"),
        ],
        default="UNKNOWN"
    )
    emergency_name = models.CharField(max_length=100, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    emergency_relation = models.CharField(max_length=50, blank=True)

    # Operational / Management Fields (admin fills or confirms)
    special_needs = models.TextField(blank=True, verbose_name="Special Educational Needs")
    admission_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)

    # Finance Link (no stored balance — dynamic from finance app)
    fee_structure = models.ForeignKey(
        'finance.FeeStructure', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='students'
    )

    # Other Links
    transport_assignment = models.ForeignKey(
        'transport.StudentAssignment', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='students'
    )
    alumni = models.OneToOneField(
        'alumni.Alumnus', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='student_profile'
    )

    # Status & Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='students_created'
    )

    class Meta:
        unique_together = ['school', 'admission_number']
        ordering = ['admission_number']
        indexes = [
            models.Index(fields=['school', 'status']),
            models.Index(fields=['school', 'current_class']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.admission_number})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.middle_name or ''} {self.last_name}".strip()

    def get_outstanding_balance(self):
        """Calculate outstanding balance considering fee assignment, admission payments, and invoice payments"""
        from apps.finance.models import Invoice, Payment, StudentFeeAssignment
        from apps.admissions.models import AdmissionFeePayment

        try:
            invoices = Invoice.objects.filter(student=self)
            if invoices.exists():
                total_balance = Decimal('0')
                for invoice in invoices:
                    invoice_balance = invoice.current_total_due - invoice.amount_paid
                    total_balance += max(Decimal('0'), invoice_balance)
                return max(Decimal('0'), total_balance)

            # Fallback to fee assignment or enrolled fee structure if no invoices exist
            fee_assignment = getattr(self, 'fee_assignment', None)
            if fee_assignment:
                return max(Decimal('0'), Decimal(str(fee_assignment.remaining_total)))
            elif self.fee_structure:
                return max(Decimal('0'), Decimal(str(self.fee_structure.total_amount or 0)))
            return Decimal('0')

        except Exception as e:
            # Fallback to old method if something goes wrong
            invoices = Invoice.objects.filter(student=self)
            total_due = invoices.aggregate(models.Sum('amount_due'))['amount_due__sum'] or 0
            total_paid = Payment.objects.filter(invoice__in=invoices).aggregate(models.Sum('amount'))['amount__sum'] or 0
            return total_due - total_paid


class Guardian(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='student_guardians')
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    relationship = models.CharField(
        max_length=50, 
        choices=[('FATHER', 'Father'), ('MOTHER', 'Mother'), ('GUARDIAN', 'Guardian'), ('OTHER', 'Other')],
        blank=True
    )
    occupation = models.CharField(max_length=100, blank=True)
    id_number = models.CharField(max_length=50, blank=True)  # Kenyan ID
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name

    class Meta:
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['email']),
        ]


class StudentGuardian(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='guardians')
    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE, related_name='students')
    is_primary = models.BooleanField(default=False)
    is_emergency_contact = models.BooleanField(default=False)
    has_pickup_permission = models.BooleanField(default=False)
    has_legal_custody = models.BooleanField(default=False)
    preferred_contact_method = models.CharField(
        max_length=20, 
        choices=[('PHONE', 'Phone'), ('EMAIL', 'Email'), ('SMS', 'SMS')],
        default='PHONE'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'guardian')

    def __str__(self):
        return f"{self.guardian.full_name} ({self.student.full_name})"


class MedicalRecord(models.Model):
    class ImmunizationStatus(models.TextChoices):
        UP_TO_DATE = "UP_TO_DATE", "Up to date"
        PARTIAL = "PARTIAL", "Partial"
        NOT_IMMUNIZED = "NOT_IMMUNIZED", "Not immunized"
        UNKNOWN = "UNKNOWN", "Unknown"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='student_medical_records')
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='student_medical_record')
    blood_group = models.CharField(max_length=5, blank=True)
    genotype = models.CharField(max_length=5, blank=True)  # For African health context
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    disabilities = models.TextField(blank=True)  # Physical/learning
    medication = models.TextField(blank=True)
    medication_instructions = models.TextField(blank=True)
    emergency_notes = models.TextField(blank=True)
    emergency_doctor = models.CharField(max_length=255, blank=True)
    preferred_hospital = models.CharField(max_length=255, blank=True)
    immunization_status = models.CharField(
        max_length=20,
        choices=ImmunizationStatus.choices,
        default=ImmunizationStatus.UNKNOWN
    )
    immunization_notes = models.TextField(blank=True)
    consent_to_treat = models.BooleanField(default=False)
    medical_disclosure_allowed = models.BooleanField(default=False)
    consent_date = models.DateField(null=True, blank=True)
    consent_by = models.ForeignKey(
        Guardian,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="medical_consents"
    )
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="medical_records_recorded"
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="medical_records_reviewed"
    )
    review_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["school", "student"]),
            models.Index(fields=["immunization_status"]),
        ]

    def __str__(self):
        return f"Medical Record for {self.student.full_name}"


class MedicalDocument(models.Model):
    medical_record = models.ForeignKey(
        MedicalRecord, on_delete=models.CASCADE, related_name="documents"
    )
    file = models.FileField(upload_to="medical_documents/")
    document_type = models.CharField(
        max_length=50, 
        choices=[('VACCINATION_CARD', 'Vaccination Card'), ('MEDICAL_REPORT', 'Medical Report'), ('OTHER', 'Other')],
        default='OTHER'
    )
    description = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Document for {self.medical_record.student.full_name}"