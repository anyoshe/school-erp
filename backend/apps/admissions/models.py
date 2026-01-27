# apps/admissions/models.py
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.academics.models import GradeLevel
from apps.students.models import Student
from apps.school.models import School


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

    class PlacementType(models.TextChoices):
        SELF = "SELF", "Self / Parent Application"
        PUBLIC = "PUBLIC", "Government / Public Authority Placement"
        TRANSFER = "TRANSFER", "Transfer from Another School"
        OTHER = "OTHER", "Other (e.g. scholarship, international)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='admission_applications')
    admission_number = models.CharField(max_length=50, unique=True, null=True, blank=True)

    # Personal
    first_name = models.CharField(max_length=50)
    middle_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50)
    preferred_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    passport_number = models.CharField(max_length=50, blank=True)

    # Class / Level
    class_applied = models.ForeignKey(
        GradeLevel,
        on_delete=models.SET_NULL,
        null=True,
        related_name='applications'
    )

    # Guardian
    primary_guardian_name = models.CharField(max_length=100, blank=True)
    primary_guardian_phone = models.CharField(max_length=20, blank=True)
    primary_guardian_email = models.EmailField(blank=True, null=True)
    primary_guardian_relationship = models.CharField(max_length=50, blank=True)
    primary_guardian_id_number = models.CharField(max_length=50, blank=True)

    # Address
    address = models.TextField(blank=True)
    region = models.CharField(max_length=100, blank=True)          # generalized from county
    district = models.CharField(max_length=100, blank=True)        # generalized from sub_county

    # Academic / Entry
    previous_school = models.CharField(max_length=255, blank=True)
    learner_id = models.CharField(max_length=50, blank=True, verbose_name="Learner ID / Student Number")
    entry_exam_id = models.CharField(max_length=50, blank=True, verbose_name="Entry / National Exam ID")
    entry_exam_year = models.PositiveIntegerField(null=True, blank=True)
    placement_type = models.CharField(
        max_length=20,
        choices=PlacementType.choices,
        default=PlacementType.SELF
    )

    # Health & Emergency
    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    disability = models.CharField(max_length=100, blank=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_relationship = models.CharField(max_length=50, blank=True)

    # Documents / Media
    photo = models.ImageField(upload_to='admission_photos/', null=True, blank=True)

    # Misc
    religion = models.CharField(max_length=50, blank=True)
    category = models.CharField(max_length=50, blank=True)  # e.g. General, Bursary, International
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submitted_at = models.DateTimeField(null=True, blank=True)
    admission_date = models.DateField(null=True, blank=True)

    student = models.OneToOneField(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admission_application'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,          # ← correct way
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_applications'
    )
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        
        if self.status == self.Status.SUBMITTED and not self.submitted_at:
            self.submitted_at = timezone.now()

        super().save(*args, **kwargs)

    def enroll_as_student(self, created_by_user):
        if not self.admission_number:
             self.admission_number = generate_unique_admission_number(self.school)
        if self.status not in [self.Status.ACCEPTED, self.Status.ENROLLED]:
            raise ValidationError("Only ACCEPTED or ENROLLED applications can be enrolled")

        if self.student:
            raise ValidationError("Already enrolled")

        # Determine if primary/elementary level (no exam fields needed)
        is_primary_level = (
            self.class_applied and
            self.class_applied.education_level in ['PRE_PRIMARY', 'ELEMENTARY']
        )

        student = Student.objects.create(
            school=self.school,
            first_name=self.first_name,
            middle_name=self.middle_name,
            last_name=self.last_name,
            gender=self.gender,
            date_of_birth=self.date_of_birth,
            nationality=self.nationality,
            region=self.region,                  # generalized
            district=self.district,
            religion=self.religion,
            current_class=self.class_applied,
            admission_date=timezone.now().date(),
            admission_number=self.admission_number,
            created_by=created_by_user,
            learner_id=self.learner_id,
            photo=self.photo,

            # Only copy exam fields if NOT primary level
            entry_exam_id=self.entry_exam_id if not is_primary_level else "",
            entry_exam_year=self.entry_exam_year if not is_primary_level else None,

            # Health & emergency
            blood_group=self.blood_group,
            allergies=self.allergies,
            chronic_conditions=self.chronic_conditions,
            disability=self.disability,
            emergency_name=self.emergency_contact_name or self.primary_guardian_name,
            emergency_phone=self.emergency_contact_phone or self.primary_guardian_phone,
            emergency_relation=self.emergency_relationship or self.primary_guardian_relationship,
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
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='documents')
    file = models.FileField(upload_to='admission_documents/')
    description = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.description or 'Document'} for {self.application}"


class AdmissionFeePayment(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='fee_payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    payment_method = models.CharField(max_length=50, blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"Payment {self.receipt_number or ''} - {self.amount}"