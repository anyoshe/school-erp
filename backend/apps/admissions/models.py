# apps/admissions/models.py
import uuid
from django.db import models
from django.utils import timezone

from apps.academics.models import GradeLevel    # ← correct import
from apps.students.models import Student       # For linking after onboarding
from apps.school.models import School          # For multi-tenancy


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
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='admission_applications')
    admission_number = models.CharField(max_length=50, unique=True, blank=True)
    first_name = models.CharField(max_length=50)
    middle_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50)
    preferred_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    class_applied = models.ForeignKey(
        GradeLevel,
        on_delete=models.SET_NULL,
        null=True,
        related_name='applications'
    )
    
    # Parent/Guardian basics
    primary_guardian_name = models.CharField(max_length=100, blank=True)
    primary_guardian_phone = models.CharField(max_length=20, blank=True)
    primary_guardian_email = models.EmailField(blank=True, null=True)
    primary_guardian_relationship = models.CharField(max_length=50, blank=True)
    
    address = models.TextField(blank=True)
    county = models.CharField(max_length=100, blank=True)
    sub_county = models.CharField(max_length=100, blank=True)
    
    previous_school = models.CharField(max_length=255, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    passport_number = models.CharField(max_length=50, blank=True)
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

    def save(self, *args, **kwargs):
        if not self.admission_number and self.school:
            year = timezone.now().year
            prefix = self.school.admission_prefix or ''
            format_type = self.school.admission_number_format
            
            if format_type == 'CUSTOM':
                # Leave blank for manual entry
                pass
            else:
                last_num = Application.objects.filter(
                    school=self.school,
                    admission_number__startswith=f"{prefix}{year}-"
                ).order_by('-admission_number').first()
                
                seq = 1
                if last_num and last_num.admission_number:
                    try:
                        seq = int(last_num.admission_number.split('-')[-1]) + 1
                    except:
                        pass
                
                seq_str = f"{seq:0{self.school.admission_seq_padding}d}"
                self.admission_number = f"{prefix}{year}-{seq_str}"
        
        if self.status == self.Status.SUBMITTED and not self.submitted_at:
            self.submitted_at = timezone.now()
        
        super().save(*args, **kwargs)

    def enroll_as_student(self, created_by_user):
        """Called when status → ENROLLED"""
        if self.status != self.Status.ACCEPTED:
            raise ValueError("Only ACCEPTED applications can be enrolled")
        
        if self.student:
            raise ValueError("Already enrolled")
        
        student = Student.objects.create(
            school=self.school,
            first_name=self.first_name,
            middle_name=self.middle_name,
            last_name=self.last_name,
            gender=self.gender,
            date_of_birth=self.date_of_birth,
            nationality=self.nationality,
            county=self.county,
            sub_county=self.sub_county,
            religion=self.religion,
            current_class=self.class_applied,
            admission_date=timezone.now().date(),
            admission_number=self.admission_number,  # Reuse the same number
            created_by=created_by_user,
            # Add more field mappings as needed (e.g., middle_name if added, etc.)
        )
        
        self.student = student
        self.status = self.Status.ENROLLED
        self.save()
        
        return student

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