# # apps/admissions/models.py
# import uuid
# from django.db import models, transaction
# from django.conf import settings
# from django.utils import timezone
# from django.core.exceptions import ValidationError
# from decimal import Decimal
# import hashlib
# from apps.academics.models import GradeLevel
# from apps.school.models import School
# from apps.students.models import Student, Guardian, StudentGuardian, MedicalRecord
# from apps.school.models import generate_unique_admission_number



# class Application(models.Model):
#     class Status(models.TextChoices):
#         DRAFT = "DRAFT", "Draft"
#         SUBMITTED = "SUBMITTED", "Submitted"
#         UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
#         TEST_SCHEDULED = "TEST_SCHEDULED", "Test Scheduled"
#         OFFERED = "OFFERED", "Offered"
#         ACCEPTED = "ACCEPTED", "Accepted"
#         REJECTED = "REJECTED", "Rejected"
#         ENROLLED = "ENROLLED", "Enrolled"
#         INTERVIEW_COMPLETED = "INTERVIEW_COMPLETED", "Interview Completed"

#     class PlacementType(models.TextChoices):
#         SELF = "SELF", "Self / Parent Application"
#         PUBLIC = "PUBLIC", "Government / Public Authority Placement"
#         TRANSFER = "TRANSFER", "Transfer from Another School"
#         OTHER = "OTHER", "Other (e.g. scholarship, international)"

#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='admission_applications')
#     admission_number = models.CharField(max_length=50, unique=True, null=True, blank=True)

#     # Personal
#     first_name = models.CharField(max_length=50)
#     middle_name = models.CharField(max_length=50, blank=True)
#     last_name = models.CharField(max_length=50)
#     preferred_name = models.CharField(max_length=100, blank=True)
#     gender = models.CharField(max_length=10, blank=True)
#     date_of_birth = models.DateField(null=True, blank=True)
#     nationality = models.CharField(max_length=100, blank=True)
#     passport_number = models.CharField(max_length=50, blank=True)

#     # Class / Level
#     class_applied = models.ForeignKey(
#         GradeLevel,
#         on_delete=models.SET_NULL,
#         null=True,
#         related_name='applications'
#     )
#      # ── NEW: Flexible Student Placement Hierarchy ──
#     section = models.CharField(
#         max_length=100, 
#         blank=True, 
#         verbose_name="Section",
#         help_text="Boys/Girls/Mixed or Lower Primary/Upper Primary/Red House etc."
#     )
#     pathway = models.CharField(
#         max_length=50, 
#         blank=True, 
#         verbose_name="Pathway",
#         help_text="STEM, ARTS, SOCIAL_SCIENCES, TECHNICAL (mainly for secondary/CBC)"
#     )
#     track = models.CharField(
#         max_length=100, 
#         blank=True, 
#         verbose_name="Track",
#         help_text="e.g. Pure Sciences, Engineering, Humanities, Business (under pathway)"
#     )
#     stream = models.CharField(
#         max_length=100, 
#         blank=True, 
#         verbose_name="Stream",
#         help_text="Final class division e.g. Blue, Orange, Green, A, B (primary or secondary)"
#     )


#     # Guardian
#     primary_guardian_name = models.CharField(max_length=100, blank=True)
#     primary_guardian_phone = models.CharField(max_length=20, blank=True)
#     primary_guardian_email = models.EmailField(blank=True, null=True)
#     primary_guardian_relationship = models.CharField(max_length=50, blank=True)
#     primary_guardian_id_number = models.CharField(max_length=50, blank=True)

#     # Address
#     address = models.TextField(blank=True)
#     region = models.CharField(max_length=100, blank=True)          # generalized from county
#     district = models.CharField(max_length=100, blank=True)        # generalized from sub_county

#     # Academic / Entry
#     previous_school = models.CharField(max_length=255, blank=True)
#     learner_id = models.CharField(max_length=50, blank=True, verbose_name="Learner ID / Student Number")
#     entry_exam_id = models.CharField(max_length=50, blank=True, verbose_name="Entry / National Exam ID")
#     entry_exam_year = models.PositiveIntegerField(null=True, blank=True)
#     placement_type = models.CharField(
#         max_length=20,
#         choices=PlacementType.choices,
#         default=PlacementType.SELF
#     )

#     # Health & Emergency
#     blood_group = models.CharField(max_length=5, blank=True)
#     allergies = models.TextField(blank=True)
#     chronic_conditions = models.TextField(blank=True)
#     disability = models.CharField(max_length=100, blank=True)
#     emergency_contact_name = models.CharField(max_length=100, blank=True)
#     emergency_contact_phone = models.CharField(max_length=20, blank=True)
#     emergency_relationship = models.CharField(max_length=50, blank=True)

#     # ── NEW: Interview Scheduling Fields ──
#     interview_date = models.DateField(null=True, blank=True)
#     interview_time = models.TimeField(null=True, blank=True)
#     interview_venue = models.CharField(max_length=200, blank=True)
#     interview_contact_person = models.CharField(max_length=100, blank=True)
#     interview_instructions = models.TextField(blank=True)


#     # Add fields
#     interview_outcome = models.CharField(
#         max_length=20,
#         choices=[
#             ("PASS", "Pass"),
#             ("FAIL", "Fail"),
#             ("WAITLIST", "Waitlist"),
#             ("OTHER", "Other"),
#         ],
#         blank=True,
#         null=True,
#     )
#     interview_comments = models.TextField(blank=True)
#     interview_completed_at = models.DateTimeField(null=True, blank=True)
#     interview_score = models.IntegerField(null=True, blank=True)
#     interviewer_name = models.CharField(max_length=100, blank=True)
#     # Add after accepted_at / acceptance_notes
#     offer_issued_at = models.DateTimeField(null=True, blank=True)
#     offer_method = models.CharField(max_length=20, blank=True)  # 'email', 'whatsapp', 'download', etc.
#     accepted_at = models.DateTimeField(null=True, blank=True)
#     acceptance_notes = models.TextField(blank=True)

#     # Documents / Media
#     photo = models.ImageField(upload_to='admission_photos/', null=True, blank=True)

#     # Misc
#     religion = models.CharField(max_length=50, blank=True)
#     category = models.CharField(max_length=50, blank=True)  # e.g. General, Bursary, International
#     notes = models.TextField(blank=True)
#     status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
#     submitted_at = models.DateTimeField(null=True, blank=True)
#     admission_date = models.DateField(null=True, blank=True)

#     student = models.OneToOneField(
#         "students.Student", 
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name='admission_application'
#     )
#     created_by = models.ForeignKey(
#         settings.AUTH_USER_MODEL,          # ← correct way
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name='created_applications'
#     )
#     updated_at = models.DateTimeField(auto_now=True)

#     def get_placement_display(self) -> str:
#         """Nice readable placement string"""
#         parts = []
#         if self.class_applied:
#             parts.append(self.class_applied.name)
#         if self.section:
#             parts.append(self.section)
#         if self.pathway:
#             parts.append(self.pathway)
#         if self.track:
#             parts.append(self.track)
#         if self.stream:
#             parts.append(self.stream)
#         return " - ".join(parts) if parts else "Not assigned"

#     def save(self, *args, **kwargs):
#         if self.status == self.Status.SUBMITTED and not self.submitted_at:
#             self.submitted_at = timezone.now()

#         # Check if record actually exists in DB
#         old = Application.objects.filter(pk=self.pk).first()
        
#         if old:
#             if self.status == self.Status.OFFERED and old.status != self.Status.OFFERED:
#                 if not self.offer_issued_at:
#                     self.offer_issued_at = timezone.now()
            
#             if self.status == self.Status.ACCEPTED and old.status != self.Status.ACCEPTED:
#                 if not self.accepted_at:
#                     self.accepted_at = timezone.now()

#         super().save(*args, **kwargs) 
    

#     @transaction.atomic
#     def enroll_as_student(self, created_by_user, wizard_data=None):
#         if self.status not in [self.Status.ACCEPTED, self.Status.ENROLLED]:
#             raise ValidationError("Only ACCEPTED applications can be enrolled")

#         if self.student:
#             raise ValidationError("Already enrolled")

#         wd = wizard_data or {}

#             # === SAFE SINGLE INITIAL DEPOSIT CREATION ===
#         try:
#             initial_amount = Decimal(str(wd.get('initial_payment_amount', 0) or 0))
#             reference = str(wd.get('initial_payment_reference', '')).strip()
#             print(f"[ENROLL PAYMENT DEBUG] Application={self.id} | Amount={initial_amount} | Ref='{reference}'")
#         except Exception as e:
#             print(f"[ENROLL PAYMENT DEBUG] Error parsing payment data: {e}")
#             initial_amount = Decimal('0')
#             reference = ''

#         if initial_amount > 0:
#             # Strong guard: check by application + amount + reference
#             if not AdmissionFeePayment.objects.filter(
#                 application=self,
#                 amount=initial_amount,
#                 receipt_number=reference
#             ).exists():
#                 payment = AdmissionFeePayment.objects.create(
#                     application=self,
#                     amount=initial_amount,
#                     payment_method=reference or "Initial Enrollment Payment",
#                     receipt_number=reference,
#                 )
#                 print(f"[ENROLL PAYMENT DEBUG] ✅ CREATED NEW PAYMENT | ID={payment.id} | Amount={initial_amount}")
#             else:
#                 print(f"[ENROLL PAYMENT DEBUG] ⚠️ SKIPPED - Payment already exists for this combo")
#         else:
#             print("[ENROLL PAYMENT DEBUG] No initial payment provided")
        
#          # Auto-generate admission number if missing
#         if not self.admission_number:
#             try:
#                 self.admission_number = generate_unique_admission_number(self.school)
#                 print(f"[ENROLL DEBUG] Generated admission number: {self.admission_number}")
#             except Exception as e:
#                 print(f"[ENROLL DEBUG] Error generating admission number: {e}")
#                 raise

#         # Save safely
#         self.save(update_fields=['admission_number'])

#         fee_structure_obj = None
#         if wd.get('fee_structure'):
#             try:
#                 from apps.finance.models import FeeStructure
#                 fee_structure_obj = FeeStructure.objects.get(pk=wd.get('fee_structure'))
#             except (FeeStructure.DoesNotExist, ValueError, TypeError):
#                 fee_structure_obj = None

#         cleaned_gender = str(self.gender or '').strip()[:10]
#         cleaned_section = str(wd.get('section', '') or '').strip()[:50]
#         cleaned_pathway = str(wd.get('pathway', '')).strip()[:50]
#         cleaned_track = str(wd.get('track', '')).strip()[:100]
#         cleaned_stream = str(wd.get('stream', '')).strip()[:100]

#         student = Student.objects.create(
#             school=self.school,
#             admission_number=self.admission_number,
#             learner_id=wd.get('learner_id') or self.learner_id,                    # ← direct copy, no rename
#             entry_exam_id=self.entry_exam_id,
#             entry_exam_year=self.entry_exam_year,
#             first_name=self.first_name,
#             middle_name=self.middle_name,
#             last_name=self.last_name,
#             preferred_name=self.preferred_name,
#             gender=cleaned_gender,
#             date_of_birth=self.date_of_birth,
#             nationality=self.nationality,
#             religion=self.religion,
#             photo=self.photo,
#             address=self.address,
#             region=self.region,                             # ← direct copy
#             district=self.district,                         # ← direct copy
#             blood_group=self.blood_group,
#             allergies=self.allergies,
#             chronic_conditions=self.chronic_conditions,
#             disability=self.disability,
#             emergency_name=self.emergency_contact_name or wd.get('emergency_name'),
#             emergency_phone=self.emergency_contact_phone or wd.get('emergency_phone'),
#             emergency_relation=self.emergency_relationship or wd.get('emergency_relation'),
#             current_class=self.class_applied,
#             boarding_status=wd.get('boarding_status', 'DAY'),
#             special_needs=wd.get('special_needs', ''),
#             notes=wd.get('notes', ''),
#             created_by=created_by_user,
#             # Admin-added / completed fields from wizard
#             birth_certificate_number=wd.get("birth_certificate_number", ""),
#             passport_number=wd.get("passport_number", ""),
#             previous_school=wd.get("previous_school", ""),
#             previous_grade=wd.get("previous_grade", ""),
#             disability_type=wd.get("disability_type", ""),
#             special_needs_category=wd.get("special_needs_category", ""),
#             transport_mode=wd.get("transport_mode", "walking"),
#             transport_route=wd.get("transport_route", ""),
#             sponsor_name=wd.get("sponsor_name", ""),
#             section=cleaned_section,
#             pathway=cleaned_pathway,
#             track=cleaned_track,
#             stream=wd.get('stream', ''),
#             house=wd.get('house', ''),
#             dorm_room=wd.get('dorm_room', ''),
#             vaccination_status=wd.get('vaccination_status', 'UNKNOWN'),
#             fee_structure=fee_structure_obj,
#         )

#         # Create fee assignment if fee structure is provided
#         if fee_structure_obj:
#             from apps.finance.models import StudentFeeAssignment
#             custom_due_date = None
#             remaining_payment_due_date = wd.get('remaining_payment_due_date') or wd.get('balance_due_date')
#             if remaining_payment_due_date:
#                 try:
#                     from datetime import date
#                     custom_due_date = date.fromisoformat(str(remaining_payment_due_date))
#                 except ValueError:
#                     custom_due_date = None

#             item_amounts = wd.get('item_amounts', {}) or {}
#             if not isinstance(item_amounts, dict):
#                 item_amounts = {}

#             assignment = StudentFeeAssignment.objects.create(
#                 student=student,
#                 fee_structure=fee_structure_obj,
#                 payment_plan_id=wd.get('payment_plan'),           # ← This was missing
#                 custom_due_date=custom_due_date,
#                 waiver_amount=Decimal(str(wd.get('waiver_amount', 0))),
#                 waiver_reason=wd.get('waiver_reason', ''),
#                 is_waived=bool(wd.get('is_waived', False)),
#                 item_amounts=item_amounts,
#                 assigned_by=created_by_user,
#             )

#             # Handle selected optional items
#             selected_optional_items = wd.get('selected_optional_items', []) or []
#             if selected_optional_items:
#                 assignment.selected_optional_items.set(selected_optional_items)

#             try:
#                 from apps.finance.signals import regenerate_invoices_for_assignment
#                 regenerate_invoices_for_assignment(assignment)
#             except Exception as e:
#                 print(f"[ENROLL DEBUG] Failed to regenerate invoices for assignment {assignment.id}: {e}")

#         # Medical record auto-created / updated
#         MedicalRecord.objects.update_or_create(
#             student=student,
#             defaults={
#                 'school': self.school,
#                 'blood_group': student.blood_group,
#                 'allergies': student.allergies,
#                 'chronic_conditions': student.chronic_conditions,
#                 'immunization_status': student.vaccination_status,
#                 'recorded_by': created_by_user,
#             }
#         )

#         # Primary guardian link
#         primary_guardian, _ = Guardian.objects.get_or_create(
#             school=self.school,
#             phone=self.primary_guardian_phone,
#             defaults={
#                 'full_name': self.primary_guardian_name,
#                 'email': self.primary_guardian_email,
#                 'relationship': self.primary_guardian_relationship,
#                 'id_number': self.primary_guardian_id_number,
#             }
#         )
#         StudentGuardian.objects.get_or_create(
#             student=student,
#             guardian=primary_guardian,
#             defaults={'is_primary': True}
#         )

#         self.student = student
#         self.status = self.Status.ENROLLED
#         self.save()

#         return student
    


# apps/admissions/models.py
import uuid
from django.db import models, transaction
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from apps.academics.models import GradeLevel
from apps.school.models import School
from apps.students.models import Student, Guardian, StudentGuardian, MedicalRecord
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

    ALLOWED_TRANSITIONS = {
        "DRAFT": {"SUBMITTED", "DRAFT"},
        "SUBMITTED": {"UNDER_REVIEW", "TEST_SCHEDULED", "REJECTED", "DRAFT"},
        "UNDER_REVIEW": {"TEST_SCHEDULED", "OFFERED", "REJECTED", "UNDER_REVIEW"},
        "TEST_SCHEDULED": {"INTERVIEW_COMPLETED", "UNDER_REVIEW", "REJECTED", "TEST_SCHEDULED"},
        "INTERVIEW_COMPLETED": {"OFFERED", "REJECTED", "UNDER_REVIEW", "INTERVIEW_COMPLETED"},
        "OFFERED": {"ACCEPTED", "REJECTED", "OFFERED"},
        "ACCEPTED": {"ACCEPTED"},
        "ENROLLED": {"ENROLLED"},
        "REJECTED": {"UNDER_REVIEW", "REJECTED"},
    }

    def can_transition_to(self, new_status: str) -> bool:
        current = (self.status or "").upper()
        target = (new_status or "").upper()
        if current == target:
            return True
        return target in self.ALLOWED_TRANSITIONS.get(current, set())

    class PlacementType(models.TextChoices):
        SELF = "SELF", "Self / Parent Application"
        PUBLIC = "PUBLIC", "Government / Public Authority Placement"
        TRANSFER = "TRANSFER", "Transfer from Another School"
        OTHER = "OTHER", "Other (e.g. scholarship, international)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='admission_applications')
    admission_number = models.CharField(max_length=50, null=True, blank=True)

    # Personal Information
    first_name = models.CharField(max_length=50)
    middle_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50)
    preferred_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    passport_number = models.CharField(max_length=50, blank=True)
    birth_certificate_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Birth Certificate Number",
    )

    # Class / Level
    class_applied = models.ForeignKey(
        GradeLevel,
        on_delete=models.SET_NULL,
        null=True,
        related_name='applications'
    )

    # ── Flexible Student Placement Hierarchy ──
    section = models.CharField(
        max_length=100, 
        blank=True, 
        verbose_name="Section",
        help_text="Boys/Girls/Mixed or Lower Primary/Upper Primary/Red House etc."
    )
    pathway = models.CharField(
        max_length=50, 
        blank=True, 
        verbose_name="Pathway",
        help_text="STEM, ARTS, SOCIAL_SCIENCES, TECHNICAL (mainly secondary/CBC)"
    )
    track = models.CharField(
        max_length=100, 
        blank=True, 
        verbose_name="Track",
        help_text="e.g. Pure Sciences, Engineering, Humanities, Business"
    )
    stream = models.CharField(
        max_length=100, 
        blank=True, 
        verbose_name="Stream",
        help_text="Final division e.g. Blue, Orange, Green, A, B"
    )

    # Guardian
    primary_guardian_name = models.CharField(max_length=100, blank=True)
    primary_guardian_phone = models.CharField(max_length=20, blank=True)
    primary_guardian_email = models.EmailField(blank=True, null=True)
    primary_guardian_relationship = models.CharField(max_length=50, blank=True)
    primary_guardian_id_number = models.CharField(max_length=50, blank=True)

    # Address
    address = models.TextField(blank=True)
    region = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)

    # Academic / Entry
    previous_school = models.CharField(max_length=255, blank=True)
    learner_id = models.CharField(max_length=50, blank=True, verbose_name="Learner ID / Student Number")
    entry_exam_id = models.CharField(max_length=50, blank=True)
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

    # Interview Fields
    interview_date = models.DateField(null=True, blank=True)
    interview_time = models.TimeField(null=True, blank=True)
    interview_venue = models.CharField(max_length=200, blank=True)
    interview_contact_person = models.CharField(max_length=100, blank=True)
    interview_instructions = models.TextField(blank=True)
    interview_outcome = models.CharField(max_length=20, blank=True, null=True,
        choices=[("PASS", "Pass"), ("FAIL", "Fail"), ("WAITLIST", "Waitlist"), ("OTHER", "Other")])
    interview_comments = models.TextField(blank=True)
    interview_completed_at = models.DateTimeField(null=True, blank=True)
    interview_score = models.IntegerField(null=True, blank=True)
    interviewer_name = models.CharField(max_length=100, blank=True)

    # Offer & Acceptance
    offer_issued_at = models.DateTimeField(null=True, blank=True)
    offer_method = models.CharField(max_length=20, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    acceptance_notes = models.TextField(blank=True)

    # Documents / Misc
    photo = models.ImageField(upload_to='admission_photos/', null=True, blank=True)
    religion = models.CharField(max_length=50, blank=True)
    category = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    rejection_reason = models.CharField(max_length=100, blank=True)
    internal_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submitted_at = models.DateTimeField(null=True, blank=True)
    admission_date = models.DateField(null=True, blank=True)

    student = models.OneToOneField(
        "students.Student", 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admission_application'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_applications'
    )
    updated_at = models.DateTimeField(auto_now=True)

    def get_placement_display(self) -> str:
        """Returns a nice readable placement string"""
        parts = []
        if self.class_applied:
            parts.append(self.class_applied.name)
        if self.section:
            parts.append(self.section)
        if self.pathway:
            parts.append(self.pathway)
        if self.track:
            parts.append(self.track)
        if self.stream:
            parts.append(self.stream)
        return " - ".join(parts) if parts else "Not assigned"

    def save(self, *args, **kwargs):
        if self.status == self.Status.SUBMITTED and not self.submitted_at:
            self.submitted_at = timezone.now()

        old = Application.objects.filter(pk=self.pk).first()
        if old:
            if self.status == self.Status.OFFERED and old.status != self.Status.OFFERED:
                if not self.offer_issued_at:
                    self.offer_issued_at = timezone.now()
            if self.status == self.Status.ACCEPTED and old.status != self.Status.ACCEPTED:
                if not self.accepted_at:
                    self.accepted_at = timezone.now()

        prev_status = getattr(old, "status", None) if self.pk else None
        super().save(*args, **kwargs)
        try:
            if prev_status is not None and prev_status != self.status:
                ApplicationStatusLog.objects.create(
                    application=self,
                    from_status=prev_status or "",
                    to_status=self.status or "",
                )
        except Exception:
            pass

    @transaction.atomic
    def enroll_as_student(self, created_by_user, wizard_data=None):
        if self.status not in [self.Status.ACCEPTED, self.Status.ENROLLED]:
            raise ValidationError("Only ACCEPTED applications can be enrolled")

        if self.student:
            raise ValidationError("Already enrolled")

        wd = wizard_data or {}

        # === Payment Handling ===
        try:
            initial_amount = Decimal(str(wd.get('initial_payment_amount', 0) or 0))
            reference = str(wd.get('initial_payment_reference', '')).strip()
        except Exception:
            initial_amount = Decimal('0')
            reference = ''

        # Enrollment deposit is school/term fee money — posted only as finance.Payment on invoices.
        # Do NOT create AdmissionFeePayment here (that table is for true admission/registration fees only).
        if initial_amount > 0:
            pass  # Payment rows are created later against student invoices in this method

        # Generate admission number if missing
        if not self.admission_number:
            self.admission_number = generate_unique_admission_number(self.school)
            self.save(update_fields=['admission_number'])

        # Fee Structure
        fee_structure_obj = None
        if wd.get('fee_structure'):
            try:
                from apps.finance.models import FeeStructure
                fee_structure_obj = FeeStructure.objects.get(pk=wd.get('fee_structure'))
            except Exception:
                fee_structure_obj = None

        # Resolve placement FKs (Application stores labels; Student uses model FKs)
        from apps.academics.models import Section, Pathway, Track, Stream

        def _resolve_fk(model, value, **filters):
            if value in (None, ""):
                return None
            qs = model.objects.filter(**filters)
            try:
                if str(value).isdigit():
                    obj = qs.filter(pk=int(value)).first()
                    if obj:
                        return obj
            except Exception:
                pass
            # UUID pk
            try:
                obj = qs.filter(pk=value).first()
                if obj:
                    return obj
            except Exception:
                pass
            return qs.filter(name__iexact=str(value).strip()).first()

        grade = self.class_applied
        section_obj = _resolve_fk(
            Section,
            wd.get("section") or self.section,
            grade_level=grade,
        ) if grade else None
        pathway_obj = _resolve_fk(
            Pathway,
            wd.get("pathway") or self.pathway,
            school=self.school,
        )
        track_val = wd.get("track")
        track_obj = (
            _resolve_fk(Track, track_val, pathway=pathway_obj)
            if pathway_obj and track_val
            else None
        )
        stream_obj = _resolve_fk(
            Stream,
            wd.get("stream") or self.stream,
            grade_level=grade,
        ) if grade else None

        # Create Student - Build on existing data
        def _w(key, fallback=""):
            v = wd.get(key)
            if v is None or (isinstance(v, str) and not str(v).strip()):
                return fallback
            return v

        # Prefer enrollment wizard overrides, else application record
        dob = _w("date_of_birth", self.date_of_birth)
        if isinstance(dob, str) and dob:
            try:
                from datetime import date as date_cls
                dob = date_cls.fromisoformat(dob[:10])
            except Exception:
                dob = self.date_of_birth

        student = Student.objects.create(
            school=self.school,
            admission_number=self.admission_number,

            learner_id=_w("learner_id", self.learner_id),
            entry_exam_id=self.entry_exam_id,
            entry_exam_year=self.entry_exam_year,
            first_name=_w("first_name", self.first_name),
            middle_name=_w("middle_name", self.middle_name),
            last_name=_w("last_name", self.last_name),
            preferred_name=_w("preferred_name", self.preferred_name),
            gender=str(_w("gender", self.gender) or "").strip()[:10],
            date_of_birth=dob,
            nationality=_w("nationality", self.nationality),
            religion=_w("religion", self.religion),
            photo=self.photo,
            address=_w("address", self.address),
            region=_w("region", self.region),
            district=_w("district", self.district),
            blood_group=self.blood_group,
            allergies=self.allergies,
            chronic_conditions=self.chronic_conditions,
            disability=self.disability,

            # Emergency contact
            emergency_name=self.emergency_contact_name or wd.get('emergency_name'),
            emergency_phone=self.emergency_contact_phone or wd.get('emergency_phone'),
            emergency_relation=self.emergency_relationship or wd.get('emergency_relation'),

            current_class=self.class_applied,
            boarding_status=wd.get('boarding_status', 'DAY'),

            # Fields mainly from wizard (with fallback)
            birth_certificate_number=wd.get("birth_certificate_number", ""),
            passport_number=wd.get("passport_number", ""),
            previous_school=wd.get("previous_school", self.previous_school),
            previous_grade=wd.get("previous_grade", ""),
            disability_type=wd.get("disability_type", ""),
            special_needs_category=wd.get("special_needs_category", ""),
            transport_mode=wd.get("transport_mode", "walking"),
            transport_route=wd.get("transport_route", ""),
            sponsor_name=wd.get("sponsor_name", ""),
            notes=wd.get('notes', self.notes or ""),

            # Placement hierarchy (resolved FK objects)
            section=section_obj,
            pathway=pathway_obj,
            track=track_obj,
            stream=stream_obj,
            house=wd.get('house', ''),
            dorm_room=wd.get('dorm_room', ''),
            vaccination_status=wd.get('vaccination_status', 'UNKNOWN'),

            fee_structure=fee_structure_obj,
            created_by=created_by_user,
        )

        # === Fee Assignment ===
        if fee_structure_obj:
            from apps.finance.models import StudentFeeAssignment
            custom_due_date = None
            remaining = wd.get('remaining_payment_due_date') or wd.get('balance_due_date')
            if remaining:
                try:
                    from datetime import date
                    custom_due_date = date.fromisoformat(str(remaining))
                except ValueError:
                    pass

            item_amounts = wd.get('item_amounts', {}) or {}
            if isinstance(item_amounts, str):
                import json
                try:
                    item_amounts = json.loads(item_amounts)
                except Exception:
                    item_amounts = {}
            if not isinstance(item_amounts, dict):
                item_amounts = {}

            plan_raw = wd.get("payment_plan")
            plan_id = None
            if plan_raw not in (None, "", "undefined", "null", "false"):
                plan_id = plan_raw

            if isinstance(item_amounts, str):
                import json
                try:
                    item_amounts = json.loads(item_amounts)
                except Exception:
                    item_amounts = {}
            if not isinstance(item_amounts, dict):
                item_amounts = {}

            assignment = StudentFeeAssignment.objects.create(
                student=student,
                fee_structure=fee_structure_obj,
                payment_plan_id=plan_id,
                custom_due_date=custom_due_date,
                waiver_amount=Decimal(str(wd.get("waiver_amount") or 0)),
                waiver_reason=str(wd.get("waiver_reason") or ""),
                is_waived=bool(wd.get("is_waived", False)),
                item_amounts=item_amounts,
                assigned_by=created_by_user,
            )

            selected_optional = wd.get('selected_optional_items', []) or []
            if selected_optional:
                assignment.selected_optional_items.set(selected_optional)

            try:
                from apps.finance.signals import regenerate_invoices_for_assignment
                regenerate_invoices_for_assignment(assignment)
            except Exception as e:
                print(f"[ENROLL] Failed to regenerate invoices: {e}")

            # Apply enrollment school-fee deposit onto the first invoice (Finance ledger)
            if initial_amount > 0:
                try:
                    from apps.finance.models import Invoice, Payment
                    invoice = (
                        Invoice.objects.filter(
                            student=student,
                            fee_assignment=assignment,
                        )
                        .order_by("due_date", "id")
                        .first()
                    )
                    if invoice:
                        already = Payment.objects.filter(
                            invoice=invoice,
                            notes__icontains="Enrollment school fee deposit",
                        ).exists()
                        if not already:
                            method = str(wd.get("initial_payment_method") or "CASH").upper()
                            if method not in {"CASH", "M-PESA", "BANK", "CHEQUE", "WAIVER", "SCHOLARSHIP"}:
                                method = "CASH"
                            pay_amt = min(initial_amount, Decimal(str(invoice.current_total_due or invoice.amount_due or initial_amount)))
                            if pay_amt > 0:
                                Payment.objects.create(
                                    school=self.school,
                                    invoice=invoice,
                                    amount=pay_amt,
                                    payment_method=method,
                                    reference_number=reference[:100] if reference else "",
                                    notes="Enrollment school fee deposit",
                                )
                except Exception as e:
                    print(f"[ENROLL] Failed to post school fee deposit to invoice: {e}")

        # Medical Record
        MedicalRecord.objects.update_or_create(
            student=student,
            defaults={
                'school': self.school,
                'blood_group': student.blood_group,
                'allergies': student.allergies,
                'chronic_conditions': student.chronic_conditions,
                'immunization_status': student.vaccination_status,
                'recorded_by': created_by_user,
            }
        )

        # Primary Guardian
        g_phone = _w("guardian_phone", self.primary_guardian_phone) or self.primary_guardian_phone
        g_name = _w("guardian_name", self.primary_guardian_name) or self.primary_guardian_name
        g_email = _w("guardian_email", self.primary_guardian_email) or self.primary_guardian_email
        g_rel = _w("guardian_relationship", self.primary_guardian_relationship) or self.primary_guardian_relationship
        g_id = _w("guardian_national_id", self.primary_guardian_id_number) or self.primary_guardian_id_number
        primary_guardian, _ = Guardian.objects.get_or_create(
            school=self.school,
            phone=g_phone or "unknown",
            defaults={
                'full_name': g_name or "Guardian",
                'email': g_email,
                'relationship': g_rel,
                'id_number': g_id,
            }
        )
        StudentGuardian.objects.get_or_create(
            student=student,
            guardian=primary_guardian,
            defaults={'is_primary': True}
        )

        # Secondary guardian (optional)
        sg_name = str(wd.get("secondary_guardian_name") or self.secondary_guardian_name or "").strip()
        sg_phone = str(wd.get("secondary_guardian_phone") or self.secondary_guardian_phone or "").strip()
        if sg_name and sg_phone:
            sec_guardian, _ = Guardian.objects.get_or_create(
                school=self.school,
                phone=sg_phone,
                defaults={
                    "full_name": sg_name,
                    "email": str(wd.get("secondary_guardian_email") or ""),
                    "relationship": str(wd.get("secondary_guardian_relationship") or "Guardian"),
                    "id_number": str(wd.get("secondary_guardian_national_id") or ""),
                },
            )
            StudentGuardian.objects.get_or_create(
                student=student,
                guardian=sec_guardian,
                defaults={"is_primary": False},
            )

        # Copy admission documents onto student medical record as attachments
        try:
            medical = getattr(student, "student_medical_record", None) or MedicalRecord.objects.filter(student=student).first()
            if medical:
                for doc in self.documents.all():
                    try:
                        if not doc.file:
                            continue
                        MedicalDocument.objects.create(
                            medical_record=medical,
                            file=doc.file,
                            document_type="OTHER",
                            description=(doc.description or "Admission document")[:255],
                        )
                    except Exception as de:
                        print(f"[ENROLL] doc copy skip: {de}")
        except Exception as e:
            print(f"[ENROLL] document copy failed: {e}")

        # Post any already-paid interview/admission charges into finance income
        try:
            from apps.finance.pre_enrollment import post_charge_to_finance
            for ch in self.charges.all():
                post_charge_to_finance(ch, student=student)
        except Exception as e:
            print(f"[ENROLL] finance income post failed: {e}")

        self.student = student
        self.status = self.Status.ENROLLED
        self.save()

        return student
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.admission_number or 'Draft'}"

    class Meta:
        ordering = ['-submitted_at', 'last_name']
        constraints = [
            models.UniqueConstraint(
                fields=['school', 'admission_number'],
                name='unique_admission_number_per_school',
                condition=models.Q(admission_number__isnull=False),
            )
        ]

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

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            school_prefix = getattr(self.application.school, 'admission_prefix', 'SCH')
            timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
            self.receipt_number = f"ADM-{school_prefix}-{timestamp}-{str(self.application.id)[:8]}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payment {self.receipt_number or ''} - {self.amount}"


class ApplicationCharge(models.Model):
    """
    Pre-enrollment charges on the application (interview / admission).
    Independent of term fee structures assigned at enroll.
    """

    class ChargeType(models.TextChoices):
        INTERVIEW = "INTERVIEW", "Interview fee"
        ADMISSION = "ADMISSION", "Admission / registration fee"

    class Policy(models.TextChoices):
        FULL = "FULL", "Full amount due"
        DISCOUNTED = "DISCOUNTED", "Discounted"
        WAIVED = "WAIVED", "Waived"
        NOT_APPLICABLE = "NOT_APPLICABLE", "Not applicable"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="charges"
    )
    charge_type = models.CharField(max_length=20, choices=ChargeType.choices)
    policy = models.CharField(
        max_length=20, choices=Policy.choices, default=Policy.NOT_APPLICABLE
    )
    list_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    waiver_reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    # Staff must explicitly choose policy / payment before stage can proceed
    decision_made = models.BooleanField(
        default=False,
        help_text="True after staff sets policy (N/A, waive, discount, or pay)",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("application", "charge_type")]
        ordering = ["charge_type"]

    def __str__(self):
        return f"{self.charge_type} ({self.policy}) for {self.application_id}"

    @property
    def is_satisfied(self) -> bool:
        # Must be an explicit staff decision, not just default N/A
        if not self.decision_made:
            return False
        if self.policy in (
            self.Policy.WAIVED,
            self.Policy.NOT_APPLICABLE,
        ):
            return True
        return self.amount_paid >= self.amount_due

    def recompute_due(self):
        from decimal import Decimal
        if self.policy == self.Policy.NOT_APPLICABLE:
            self.amount_due = Decimal("0")
        elif self.policy == self.Policy.WAIVED:
            self.amount_due = Decimal("0")
        elif self.policy == self.Policy.DISCOUNTED:
            self.amount_due = max(
                Decimal("0"),
                Decimal(str(self.list_amount)) - Decimal(str(self.discount_amount)),
            )
        else:
            self.amount_due = Decimal(str(self.list_amount or 0))


class ApplicationStatusLog(models.Model):
    """Audit trail for admissions pipeline status changes."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="status_logs"
    )
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admission_status_changes",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.application_id}: {self.from_status} → {self.to_status}"
