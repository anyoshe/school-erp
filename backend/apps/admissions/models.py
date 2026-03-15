# apps/admissions/models.py
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
import hashlib
from apps.academics.models import GradeLevel
from apps.students.models import Student
from apps.school.models import School
# At the very top of admissions/models.py, after other imports
from apps.students.models import Student, Guardian, StudentGuardian, MedicalRecord, MedicalDocument
from apps.school.models import generate_unique_admission_number


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
        INTERVIEW_COMPLETED = "INTERVIEW_COMPLETED", "Interview Completed"

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

    # ── NEW: Interview Scheduling Fields ──
    interview_date = models.DateField(null=True, blank=True)
    interview_time = models.TimeField(null=True, blank=True)
    interview_venue = models.CharField(max_length=200, blank=True)
    interview_contact_person = models.CharField(max_length=100, blank=True)
    interview_instructions = models.TextField(blank=True)


    # Add fields
    interview_outcome = models.CharField(
        max_length=20,
        choices=[
            ("PASS", "Pass"),
            ("FAIL", "Fail"),
            ("WAITLIST", "Waitlist"),
            ("OTHER", "Other"),
        ],
        blank=True,
        null=True,
    )
    interview_comments = models.TextField(blank=True)
    interview_completed_at = models.DateTimeField(null=True, blank=True)
    interview_score = models.IntegerField(null=True, blank=True)
    interviewer_name = models.CharField(max_length=100, blank=True)
    # Add after accepted_at / acceptance_notes
    offer_issued_at = models.DateTimeField(null=True, blank=True)
    offer_method = models.CharField(max_length=20, blank=True)  # 'email', 'whatsapp', 'download', etc.
    accepted_at = models.DateTimeField(null=True, blank=True)
    acceptance_notes = models.TextField(blank=True)

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

        # Check if record actually exists in DB
        old = Application.objects.filter(pk=self.pk).first()
        
        if old:
            if self.status == self.Status.OFFERED and old.status != self.Status.OFFERED:
                if not self.offer_issued_at:
                    self.offer_issued_at = timezone.now()
            
            if self.status == self.Status.ACCEPTED and old.status != self.Status.ACCEPTED:
                if not self.accepted_at:
                    self.accepted_at = timezone.now()

        super().save(*args, **kwargs) 


    def enroll_as_student(self, created_by_user, wizard_data=None):
        if self.status not in [self.Status.ACCEPTED, self.Status.ENROLLED]:
            raise ValidationError("Only ACCEPTED applications can be enrolled")

        if self.student:
            raise ValidationError("Already enrolled")

        wd = wizard_data or {}

        # Auto-generate admission number if missing
        if not self.admission_number:
            self.admission_number = generate_unique_admission_number(self.school)
            self.save(update_fields=['admission_number'])

        student = Student.objects.create(
            school=self.school,
            admission_number=self.admission_number,
            learner_id=self.learner_id,                     # ← direct copy, no rename
            entry_exam_id=self.entry_exam_id,
            entry_exam_year=self.entry_exam_year,
            first_name=self.first_name,
            middle_name=self.middle_name,
            last_name=self.last_name,
            preferred_name=self.preferred_name,
            gender=self.gender,
            date_of_birth=self.date_of_birth,
            nationality=self.nationality,
            religion=self.religion,
            photo=self.photo,
            address=self.address,
            region=self.region,                             # ← direct copy
            district=self.district,                         # ← direct copy
            blood_group=self.blood_group,
            allergies=self.allergies,
            chronic_conditions=self.chronic_conditions,
            disability=self.disability,
            emergency_name=self.emergency_contact_name or wd.get('emergency_name'),
            emergency_phone=self.emergency_contact_phone or wd.get('emergency_phone'),
            emergency_relation=self.emergency_relationship or wd.get('emergency_relation'),
            current_class=self.class_applied,
            boarding_status=wd.get('boarding_status', 'DAY'),
            special_needs=wd.get('special_needs', ''),
            notes=wd.get('notes', ''),
            created_by=created_by_user,
            # Admin-added / completed fields from wizard
            birth_certificate_number=wd.get("birth_certificate_number", ""),
            passport_number=wd.get("passport_number", ""),
            previous_school=wd.get("previous_school", ""),
            previous_grade=wd.get("previous_grade", ""),
            disability_type=wd.get("disability_type", ""),
            special_needs_category=wd.get("special_needs_category", ""),
            transport_mode=wd.get("transport_mode", "walking"),
            transport_route=wd.get("transport_route", ""),
            sponsor_name=wd.get("sponsor_name", ""),
            section=wd.get('section', ''),
            stream=wd.get('stream', ''),
            house=wd.get('house', ''),
            dorm_room=wd.get('dorm_room', ''),
            vaccination_status=wd.get('vaccination_status', 'UNKNOWN'),
            fee_structure=wd.get('fee_structure'),          # Link to finance app
        )

        # Medical record auto-created / updated
        MedicalRecord.objects.update_or_create(
            student=student,
            defaults={
                'school': self.school,
                'blood_group': student.blood_group,
                'allergies': student.allergies,
                'chronic_conditions': student.chronic_conditions,
                'vaccination_status': student.vaccination_status,
                'recorded_by': created_by_user,
            }
        )

        # Primary guardian link
        primary_guardian, _ = Guardian.objects.get_or_create(
            school=self.school,
            phone=self.primary_guardian_phone,
            defaults={
                'full_name': self.primary_guardian_name,
                'email': self.primary_guardian_email,
                'relationship': self.primary_guardian_relationship,
                'id_number': self.primary_guardian_id_number,
            }
        )
        StudentGuardian.objects.get_or_create(
            student=student,
            guardian=primary_guardian,
            defaults={'is_primary': True}
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

    checksum = models.CharField(
    max_length=64,
    editable=False,
    unique=False,  # still unique per application via UniqueConstraint
    null=False,    # explicitly non-nullable now
)


    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["application", "checksum"],
                name="unique_document_per_application"
            )
        ]
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