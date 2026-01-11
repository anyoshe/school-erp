# apps/admissions/models.py
import uuid
from django.db import models
from django.utils import timezone

from apps.academics.models import GradeLevel    # ← correct import
from apps.students.models import Student       # For linking after onboarding


class Application(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        TEST_SCHEDULED = "TEST_SCHEDULED", "Test Scheduled"
        OFFERED = "OFFERED", "Offered"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        ENROLLED = "ENROLLED", "Enrolled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admission_number = models.CharField(max_length=50, unique=True, blank=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    gender = models.CharField(max_length=10, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    class_applied = models.ForeignKey(
        GradeLevel,
        on_delete=models.SET_NULL,
        null=True,
        related_name='applications'
    )
    
    # Parent/Guardian basics
    parent_name = models.CharField(max_length=100, blank=True)
    parent_phone = models.CharField(max_length=20, blank=True)
    parent_email = models.EmailField(blank=True, null=True)
    
    address = models.TextField(blank=True)
    
    previous_school = models.CharField(max_length=255, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    religion = models.CharField(max_length=50, blank=True)
    category = models.CharField(max_length=50, blank=True)  # e.g., General/SC/ST
    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    admission_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    student = models.OneToOneField(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admission_application'
    )
    
    # Future: add school FK when ready
    # school = models.ForeignKey('school.School', on_delete=models.CASCADE, null=True)

    def save(self, *args, **kwargs):
        if not self.admission_number:
            year = timezone.now().year
            seq = Application.objects.filter(
                admission_number__startswith=f'ADM-{year}-'
            ).count() + 1
            self.admission_number = f'ADM-{year}-{seq:04d}'
        
        if self.status == self.Status.SUBMITTED and not self.submitted_at:
            self.submitted_at = timezone.now()
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.admission_number or 'Draft'}"

    class Meta:
        ordering = ['-submitted_at', 'last_name']


class ApplicationDocument(models.Model):
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    file = models.FileField(upload_to='admission_documents/')
    description = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.description or 'Document'} for {self.application}"


class AdmissionFeePayment(models.Model):
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='fee_payments'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    payment_method = models.CharField(max_length=50, blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"Payment {self.receipt_number or ''} - {self.amount}"