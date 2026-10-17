# # schools/models.py
# import uuid
# from django.db import models
# from datetime import datetime
# from django.db.models import Max
# from django.core.exceptions import ValidationError
# from django.db import transaction
# from django.conf import settings
# from django.utils.text import slugify 
# import re

# User = settings.AUTH_USER_MODEL


# class Module(models.Model):
#     """
#     Feature flags - which major modules this school has activated
#     """
#     name = models.CharField(max_length=100, unique=True)
#     code = models.CharField(max_length=50, unique=True)  # e.g. 'students', 'finance'

#     def __str__(self):
#         return self.name


# class School(models.Model):
#     """
#     Main tenant entity - represents one school/institution
#     """
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=255)
#     short_name = models.CharField(max_length=50, blank=True)
#     email = models.EmailField(blank=True, null=True)
#     phone = models.CharField(max_length=20, blank=True)
#     alternative_phone = models.CharField(max_length=20, blank=True, verbose_name="Alternative Phone")
#     emergency_phone = models.CharField(max_length=20, blank=True, verbose_name="Emergency Phone")
#     postal_address = models.TextField(blank=True, verbose_name="Postal Address")
#     address = models.TextField(blank=True)
#     city = models.CharField(max_length=100, blank=True)
#     country = models.CharField(max_length=100, default="Kenya")
#     website = models.URLField(blank=True)
#     logo = models.ImageField(upload_to="school_logos/", blank=True, null=True)
#     CURRENCY_CHOICES = [
#         ("KES", "Kenyan Shilling"),
#         ("USD", "US Dollar"),
#         ("EUR", "Euro"),
#         ("GBP", "British Pound"),
#         ("UGX", "Ugandan Shilling"),
#         ("TZS", "Tanzanian Shilling"),
#         ("RWF", "Rwandan Franc"),
#         ("NGN", "Nigerian Naira"),
#         # Add more as your platform grows
#     ]

#     currency = models.CharField(
#         max_length=10,
#         choices=CURRENCY_CHOICES,
#         default="KES",
#         help_text="Primary currency for fees, invoices, payments"
#     )

#     currency_symbol = models.CharField(
#         max_length=8,
#         blank=True,
#         default="KSh",
#         help_text="Display symbol (e.g. KSh, $, €, £, UGX). Leave blank to use code."
#     )

#     # Helper property for display
#     @property
#     def currency_display(self):
#         return self.currency_symbol.strip() or self.currency
#     # Official registration details
#     official_registration_number = models.CharField(
#         max_length=100,
#         blank=True,
#         null=True,
#         verbose_name="Official Registration / Licence Number",
#         help_text="Enter the official registration number issued by your country's education authority (MOE, KNEC, State Board, etc.)"
#     )

#     registration_authority = models.CharField(
#         max_length=100,
#         blank=True,
#         null=True,
#         verbose_name="Issuing Authority",
#         help_text="e.g. Ministry of Education, State Board of Education, Private Schools Regulatory Authority, etc."
#     )

#     registration_date = models.DateField(
#         blank=True,
#         null=True,
#         verbose_name="Registration Date"
#     )
    
#     # School-wide academic defaults (can be overridden per curriculum)
#     academic_year_start_month = models.CharField(
#         max_length=20, 
#         default="January",
#         help_text="Start month of academic year"
#     )
#     academic_year_end_month = models.CharField(
#         max_length=20, 
#         default="December",
#         help_text="End month of academic year"
#     )
#     term_system = models.CharField(max_length=20, default="terms")  # terms / semesters
#     number_of_terms = models.PositiveIntegerField(default=3)
#     grading_system = models.CharField(max_length=20, default="percentage")
#     passing_mark = models.PositiveIntegerField(default=50)

#     # ── NEW: Admission Number Configuration ───────────────────────────────
#     ADMISSION_NUMBER_FORMAT_CHOICES = [
#         ('YEAR_SEQ', 'Year + Sequential (2026-0001)'),
#         ('PREFIX_YEAR_SEQ', 'Prefix + Year + Sequential (ABC-2026-0001)'),
#         ('CUSTOM', 'Manual entry (admin enters number)'),
#     ]

#     admission_number_format = models.CharField(
#         max_length=20,
#         choices=ADMISSION_NUMBER_FORMAT_CHOICES,
#         default='PREFIX_SEQ',
#         verbose_name="Admission Number Format",
#         help_text="How admission/application numbers should be generated for this school"
#     )

#     admission_prefix = models.CharField(
#         max_length=20,
#         blank=True,
#         verbose_name="Admission Number Prefix",
#         help_text="Optional prefix (e.g. 'KCB-', 'INT-', 'SCH-'). Only used if format includes prefix."
#     )

#     admission_seq_padding = models.PositiveSmallIntegerField(
#         default=4,
#         verbose_name="Sequence Number Padding",
#         help_text="Number of digits for the sequential part (e.g. 4 → 0001, 5 → 00001)"
#     )
#     # ────────────────────────────────────────────────────────────────────────

#     # Activated features/modules
#     modules = models.ManyToManyField(Module, blank=True, related_name="schools")

#     # Access control
#     owner = models.ForeignKey(
#         User, on_delete=models.SET_NULL, null=True, related_name="owned_schools"
#     )
#     users = models.ManyToManyField(User, blank=True, related_name="schools")

#     setup_complete = models.BooleanField(default=False)  # Wizard finished?

#     slug = models.SlugField(
#         max_length=100,
#         unique=True,
#         blank=True,          # allow blank so old records don't break
#         null=True,           # allow null for old records during migration
#         help_text="Auto-generated from name (used in public URLs)"
#     )

#     def save(self, *args, **kwargs):
#         if not self.slug and self.name:
#             # Clean name for better slug
#             name_clean = re.sub(r'\s*\([^)]*\)', '', self.name)     # remove (SMSS)
#             name_clean = re.sub(r'\.', '', name_clean)               # remove dots
#             name_clean = name_clean.strip().lower()
            
#             base_slug = slugify(name_clean)
            
#             # Avoid duplicates
#             slug = base_slug
#             counter = 1
#             while School.objects.filter(slug=slug).exclude(id=self.id).exists():
#                 slug = f"{base_slug}-{counter}"
#                 counter += 1
            
#             self.slug = slug[:100]  # respect max_length

#         super().save(*args, **kwargs)
#     # ── NEW: Financial & Banking Details ───────────────────────────────
#     bank_name = models.CharField(
#         max_length=100, 
#         blank=True, 
#         help_text="e.g. KCB, Equity, Co-operative Bank"
#     )
#     branch_name = models.CharField(
#         max_length=100, 
#         blank=True, 
#         help_text="e.g. Westlands Branch"
#     )
#     bank_account_name = models.CharField(
#         max_length=255, 
#         blank=True, 
#         help_text="Official name as it appears in the bank"
#     )
#     bank_account_number = models.CharField(
#         max_length=50, 
#         blank=True
#     )
#     paybill_number = models.CharField(
#         max_length=50, 
#         blank=True, 
#         verbose_name="M-Pesa Paybill / Till Number"
#     )
#     payment_instructions = models.TextField(
#         blank=True, 
#         help_text="Additional notes like: 'Please use student name as reference'"
#     )
#     # ──────────────────────────────────────────────────────────────────
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)

#     class Meta:
#         ordering = ["name"]

#     def __str__(self):
#         return self.short_name or self.name
    
# (old commented generator removed)

# apps/school/models.py
import uuid
import re
from django.db import models
from django.db import transaction
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.text import slugify

User = settings.AUTH_USER_MODEL


class Module(models.Model):
    """Feature flags — which major modules this school has activated."""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)  # e.g. 'students', 'finance'

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# =========================================================
# SCHOOL MODEL (MAIN TENANT)
# =========================================================

class School(models.Model):
    """
    Main tenant entity.

    One record = One school/institution.
    """

    # =====================================================
    # IDENTIFIERS
    # =====================================================

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    name = models.CharField(max_length=255)

    short_name = models.CharField(
        max_length=50,
        blank=True
    )

    slug = models.SlugField(
        max_length=100,
        unique=True,
        blank=True,
        null=True,
        help_text="Auto-generated from school name"
    )


    # =====================================================
    # CONTACT INFORMATION
    # =====================================================

    email = models.EmailField(blank=True, null=True)

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    alternative_phone = models.CharField(
        max_length=20,
        blank=True
    )

    emergency_phone = models.CharField(
        max_length=20,
        blank=True
    )

    postal_address = models.TextField(blank=True)

    address = models.TextField(blank=True)

    city = models.CharField(
        max_length=100,
        blank=True
    )

    country = models.CharField(
        max_length=100,
        default="Kenya"
    )

    website = models.URLField(blank=True)

    logo = models.ImageField(
        upload_to="school_logos/",
        blank=True,
        null=True
    )


    # =====================================================
    # CURRENCY SETTINGS
    # =====================================================

    CURRENCY_CHOICES = [
        ("KES", "Kenyan Shilling"),
        ("USD", "US Dollar"),
        ("EUR", "Euro"),
        ("GBP", "British Pound"),
        ("UGX", "Ugandan Shilling"),
        ("TZS", "Tanzanian Shilling"),
        ("RWF", "Rwandan Franc"),
        ("NGN", "Nigerian Naira"),
    ]

    currency = models.CharField(
        max_length=10,
        choices=CURRENCY_CHOICES,
        default="KES"
    )

    currency_symbol = models.CharField(
        max_length=8,
        blank=True,
        default="KSh"
    )

    @property
    def currency_display(self):
        return self.currency_symbol.strip() or self.currency


    # =====================================================
    # REGISTRATION DETAILS
    # =====================================================

    official_registration_number = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    registration_authority = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    registration_date = models.DateField(
        blank=True,
        null=True
    )


    # =====================================================
    # ACADEMIC SETTINGS
    # =====================================================

    academic_year_start_month = models.CharField(
        max_length=20,
        default="January"
    )

    academic_year_end_month = models.CharField(
        max_length=20,
        default="December"
    )

    term_system = models.CharField(
        max_length=20,
        default="terms"
    )

    number_of_terms = models.PositiveIntegerField(
        default=3
    )

    grading_system = models.CharField(
        max_length=20,
        default="percentage"
    )

    passing_mark = models.PositiveIntegerField(
        default=50
    )


    # =====================================================
    # ADMISSION NUMBER CONFIG
    # =====================================================

    ADMISSION_NUMBER_FORMAT_CHOICES = [
        ('PREFIX_SEQ', 'Prefix + Sequential (PSS001)'),
        ('YEAR_SEQ', 'Year + Sequential (2026-0001)'),
        ('PREFIX_YEAR_SEQ', 'Prefix + Year + Sequential (ABC-2026-0001)'),
        ('CUSTOM', 'Manual entry only'),
    ]

    admission_number_format = models.CharField(
        max_length=20,
        choices=ADMISSION_NUMBER_FORMAT_CHOICES,
        default='PREFIX_SEQ'
    )

    admission_prefix = models.CharField(
        max_length=20,
        blank=True,
        help_text="School code for numbers, e.g. PSS → PSS001, PSS002",
    )

    admission_seq_padding = models.PositiveSmallIntegerField(
        default=3,
        help_text="Digits after prefix, e.g. 3 → PSS001",
    )


    # =====================================================
    # FINANCIAL SETTINGS
    # =====================================================

    bank_name = models.CharField(
        max_length=100,
        blank=True
    )

    branch_name = models.CharField(
        max_length=100,
        blank=True
    )

    bank_account_name = models.CharField(
        max_length=255,
        blank=True
    )

    bank_account_number = models.CharField(
        max_length=50,
        blank=True
    )

    paybill_number = models.CharField(
        max_length=50,
        blank=True
    )

    payment_instructions = models.TextField(
        blank=True
    )


    # =====================================================
    # MULTI-TENANT ACCESS
    # =====================================================

    modules = models.ManyToManyField(
        Module,
        blank=True,
        related_name="schools"
    )

    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="owned_schools"
    )

    users = models.ManyToManyField(
        User,
        blank=True,
        related_name="schools"
    )


    # =====================================================
    # SYSTEM FLAGS
    # =====================================================

    setup_complete = models.BooleanField(
        default=False
    )


    # =====================================================
    # METADATA
    # =====================================================

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )


    # =====================================================
    # MODEL SETTINGS
    # =====================================================

    class Meta:
        ordering = ["name"]


    # =====================================================
    # METHODS
    # =====================================================

    def __str__(self):
        return self.short_name or self.name


    def save(self, *args, **kwargs):

        if not self.slug and self.name:

            name_clean = re.sub(
                r'\s*\([^)]*\)',
                '',
                self.name
            )

            name_clean = re.sub(
                r'\.',
                '',
                name_clean
            )

            name_clean = name_clean.strip().lower()

            base_slug = slugify(name_clean)

            slug = base_slug
            counter = 1

            while School.objects.filter(
                slug=slug
            ).exclude(id=self.id).exists():

                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug[:100]

        super().save(*args, **kwargs)


class SchoolSupportSession(models.Model):
    """Auditable, time-bounded read-only access to a school's data by support staff."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    administrator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="school_support_sessions",
    )
    school = models.ForeignKey(
        School,
        on_delete=models.PROTECT,
        related_name="support_sessions",
    )
    reason = models.CharField(max_length=500)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["administrator", "ended_at"]),
            models.Index(fields=["school", "started_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["administrator"],
                condition=Q(ended_at__isnull=True),
                name="one_active_school_support_per_admin",
            )
        ]

    def __str__(self):
        return f"{self.administrator_id} supporting {self.school_id}"


class SchoolSupportAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    administrator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="school_support_audit_entries",
    )
    school = models.ForeignKey(
        School,
        on_delete=models.PROTECT,
        related_name="support_audit_entries",
    )
    support_session = models.ForeignKey(
        SchoolSupportSession,
        on_delete=models.PROTECT,
        related_name="audit_entries",
    )
    action = models.CharField(max_length=50)
    record_type = models.CharField(max_length=100, blank=True)
    record_id = models.CharField(max_length=100, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [models.Index(fields=["school", "timestamp"])]

    def __str__(self):
        return f"{self.action} on {self.school_id} by {self.administrator_id}"



# =========================================================
# ADMISSION NUMBER GENERATOR
# =========================================================


def generate_unique_admission_number(school):
    """
    Unique admission number per school only (multi-tenant safe).

    PREFIX_SEQ       -> PSS001, PSS002
    YEAR_SEQ         -> 2026-0001
    PREFIX_YEAR_SEQ  -> PSS-2026-0001
    CUSTOM           -> not auto-generated
    """
    import re as _re
    from apps.admissions.models import Application
    from apps.students.models import Student

    format_type = (getattr(school, "admission_number_format", None) or "PREFIX_SEQ").strip()
    if format_type == "CUSTOM":
        raise ValidationError(
            "This school uses manual admission numbers. Enter a number on the enroll form."
        )

    prefix = (getattr(school, "admission_prefix", None) or "").strip()
    padding = getattr(school, "admission_seq_padding", None) or 3
    if padding < 1:
        padding = 3
    if padding > 8:
        padding = 8

    current_year = timezone.now().year

    if format_type in ("PREFIX_SEQ", "PREFIX_YEAR_SEQ") and not prefix:
        raise ValidationError(
            "Set the school's admission_prefix (e.g. PSS) before auto-generating numbers."
        )

    with transaction.atomic():
        School.objects.select_for_update().filter(pk=school.pk).first()

        apps = Application.objects.filter(school=school).exclude(
            admission_number__isnull=True
        ).exclude(admission_number="").values_list("admission_number", flat=True)
        students = Student.objects.filter(school=school).exclude(
            admission_number__isnull=True
        ).exclude(admission_number="").values_list("admission_number", flat=True)

        existing_numbers = set(str(x) for x in apps) | set(str(x) for x in students)

        def extract_seq(num: str) -> int:
            m = _re.search(r"(\d+)$", str(num).strip())
            if not m:
                return 0
            try:
                return int(m.group(1))
            except ValueError:
                return 0

        max_seq = 0
        for num in existing_numbers:
            n = str(num)
            if format_type == "PREFIX_SEQ":
                if not n.upper().startswith(prefix.upper()):
                    continue
            elif format_type == "YEAR_SEQ":
                if not n.startswith(str(current_year)):
                    continue
            elif format_type == "PREFIX_YEAR_SEQ":
                if not n.upper().startswith(f"{prefix.upper()}-{current_year}"):
                    continue
            max_seq = max(max_seq, extract_seq(n))

        next_seq = max_seq
        while True:
            next_seq += 1
            seq_str = f"{next_seq:0{padding}d}"

            if format_type == "PREFIX_SEQ":
                candidate = f"{prefix}{seq_str}"
            elif format_type == "YEAR_SEQ":
                candidate = f"{current_year}-{seq_str}"
            elif format_type == "PREFIX_YEAR_SEQ":
                candidate = f"{prefix}-{current_year}-{seq_str}"
            else:
                raise ValidationError("Unsupported admission number format.")

            if candidate in existing_numbers:
                continue
            if Application.objects.filter(school=school, admission_number=candidate).exists():
                continue
            if Student.objects.filter(school=school, admission_number=candidate).exists():
                continue
            return candidate

