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
    current_class = models.ForeignKey('academics.Class', on_delete=models.SET_NULL, null=True, blank=True)
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
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="medical_records")
    allergies = models.TextField(blank=True)
    conditions = models.TextField(blank=True)
    immunization_notes = models.TextField(blank=True)
    last_visit = models.DateField(null=True, blank=True)
    # Optional: inherit school from student
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)
