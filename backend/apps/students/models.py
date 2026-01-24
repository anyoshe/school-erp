# students/models.py
import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.accounts.models import User  # Assuming custom User
from apps.school.models import School  # Multi-tenancy

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
    
    # Identification
    admission_number = models.CharField(max_length=50, unique=True)
    upi_number = models.CharField(max_length=50, blank=True, unique=True)  # Kenyan NEMIS UPI
    nemis_id = models.CharField(max_length=50, blank=True)  # For NEMIS integration
    
    # Personal Info
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    gender = models.CharField(max_length=10, choices=Gender.choices)
    date_of_birth = models.DateField()
    nationality = models.CharField(max_length=50, default="Kenyan")
    county = models.CharField(max_length=100, blank=True)  # Kenyan-specific
    sub_county = models.CharField(max_length=100, blank=True)
    religion = models.CharField(max_length=50, blank=True)
    photo = models.ImageField(upload_to='student_photos/', blank=True, null=True)

    kcpe_index = models.CharField(max_length=20, blank=True)  # Renamed for consistency
    kcpe_year = models.PositiveIntegerField(null=True, blank=True)
    # upi_number already exists
    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True, help_text="e.g. peanuts, bee stings, penicillin")
    chronic_conditions = models.TextField(blank=True)
    disability = models.CharField(max_length=100, blank=True)
    emergency_name = models.CharField(max_length=100, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    emergency_relation = models.CharField(max_length=50, blank=True)
    
    # Academic Info
    current_class = models.ForeignKey(
         'academics.GradeLevel', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='students'
    )  # Assuming academics app has Class model
    stream = models.CharField(max_length=50, blank=True)  # e.g. "Red", "Blue" for Kenyan schools
    boarding_status = models.CharField(
        max_length=20, 
        choices=[('DAY', 'Day'), ('BOARDING', 'Boarding'), ('MIXED', 'Mixed')],
        default='DAY'
    )
    special_needs = models.TextField(blank=True)  # For inclusive education in Kenya
    admission_date = models.DateField(auto_now_add=True)
    graduation_date = models.DateField(null=True, blank=True)
    
    # Financial Info
    fee_balance = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    scholarship = models.BooleanField(default=False)
    bursary_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0,
        blank=True
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
    
    # Status & Admin
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.ACTIVE
    )
    notes = models.TextField(blank=True)
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
        return f"{self.first_name} {self.middle_name} {self.last_name}".strip()


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