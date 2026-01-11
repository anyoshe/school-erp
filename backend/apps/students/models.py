# students/models.py
import uuid
from django.db import models
from apps.accounts.models import User

class Student(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE"
        GRADUATED = "GRADUATED"
        TRANSFERRED = "TRANSFERRED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admission_number = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    gender = models.CharField(max_length=10)
    date_of_birth = models.DateField()
    current_class = models.ForeignKey('academics.GradeLevel', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
     # Phase-4-ready school FK
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)

class Guardian(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)

    address = models.TextField(blank=True, null=True)   # ✅ add
    is_active = models.BooleanField(default=True)       # ✅ add

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["phone"]),
            models.Index(fields=["email"]),
        ]


class StudentGuardian(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE)
    relationship = models.CharField(max_length=50)
    is_primary = models.BooleanField(default=False)
    is_emergency_contact = models.BooleanField(default=False)
    has_pickup_permission = models.BooleanField(default=False)
    has_legal_custody = models.BooleanField(default=False)
    preferred_contact_method = models.CharField(max_length=20, blank=True, null=True)  # optional

    is_active = models.BooleanField(default=True)  # if you use it

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        unique_together = ('student', 'guardian')
class MedicalRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 🔗 Core link
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="medical_records"
    )

    # 🩸 Emergency & Risk-Critical
    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    special_needs = models.TextField(blank=True)

    medication = models.TextField(blank=True)
    medication_instructions = models.TextField(blank=True)

    emergency_notes = models.TextField(blank=True)
    emergency_doctor = models.CharField(max_length=255, blank=True)
    preferred_hospital = models.CharField(max_length=255, blank=True)
   # Optional: inherit school from student
   # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)
   
    # 💉 Immunization (structured)
    class ImmunizationStatus(models.TextChoices):
        UP_TO_DATE = "UP_TO_DATE", "Up to date"
        PARTIAL = "PARTIAL", "Partial"
        NOT_IMMUNIZED = "NOT_IMMUNIZED", "Not immunized"

    immunization_status = models.CharField(
        max_length=20,
        choices=ImmunizationStatus.choices,
        default=ImmunizationStatus.NOT_IMMUNIZED
    )

    immunization_notes = models.TextField(blank=True)

    # ⚖️ Consent & Legal
    consent_to_treat = models.BooleanField(default=False)
    medical_disclosure_allowed = models.BooleanField(default=False)

    consent_date = models.DateField(null=True, blank=True)
    consent_by = models.ForeignKey(
        Guardian,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="medical_consents"
    )

    # 🧾 Audit & Review
    recorded_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="medical_records_created"
    )

    reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="medical_records_reviewed"
    )

    review_date = models.DateField(null=True, blank=True)

    # 🕒 System fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["student"]),
            models.Index(fields=["immunization_status"]),
        ]

    def __str__(self):
        return f"Medical Record – {self.student}"
class MedicalDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medical_record = models.ForeignKey(
        MedicalRecord, on_delete=models.CASCADE, related_name="documents"
    )
    file = models.FileField(upload_to="medical_documents/")
    description = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
