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
#         default='YEAR_SEQ',
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
    
# def generate_unique_admission_number(school):
#     """
#     Generates a truly unique admission number using school's configuration.
#     Safely handles deleted records and race conditions.
#     """
#     if not school.admission_number_format:
#         raise ValidationError("School has no admission number format configured.")

#     from apps.admissions.models import Application
#     from apps.students.models import Student
#     from django.utils import timezone

#     current_year = timezone.now().year
#     prefix = (school.admission_prefix or "").strip()
#     padding = school.admission_seq_padding or 4
#     format_type = school.admission_number_format

#     with transaction.atomic():
#         # Lock the school to prevent concurrent generation issues
#         School.objects.select_for_update().filter(pk=school.pk).first()

#         # Check BOTH Application and Student tables for existing numbers in this year
#         existing_numbers = set()

#         # From Applications
#         apps = Application.objects.filter(
#             school=school,
#             admission_number__startswith=str(current_year)
#         ).values_list('admission_number', flat=True)
#         existing_numbers.update(apps)

#         # From Students (in case some are already enrolled)
#         students = Student.objects.filter(
#             school=school,
#             admission_number__startswith=str(current_year)
#         ).values_list('admission_number', flat=True)
#         existing_numbers.update(students)

#         # Find the highest sequence number used this year
#         max_seq = 0
#         for num in existing_numbers:
#             try:
#                 # Extract the last part after the last '-'
#                 seq_part = num.split('-')[-1]
#                 seq = int(seq_part)
#                 if seq > max_seq:
#                     max_seq = seq
#             except (ValueError, IndexError):
#                 continue

#         # Generate next number, incrementing until we find a free one
#         while True:
#             next_seq = max_seq + 1
#             seq_str = f"{next_seq:0{padding}d}"

#             if format_type == 'YEAR_SEQ':
#                 candidate = f"{current_year}-{seq_str}"
#             elif format_type == 'PREFIX_YEAR_SEQ':
#                 if not prefix:
#                     raise ValidationError("Prefix is required for PREFIX_YEAR_SEQ format.")
#                 candidate = f"{prefix}-{current_year}-{seq_str}"
#             else:
#                 raise ValidationError(f"Unknown admission number format: {format_type}")

#             # Final safety check
#             if (not Application.objects.filter(school=school, admission_number=candidate).exists() and
#                 not Student.objects.filter(school=school, admission_number=candidate).exists()):
#                 print(f"[ADMISSION NUMBER] Generated: {candidate}")
#                 return candidate

#             max_seq = next_seq  # continue incrementing if somehow taken


# schools/models.py

import uuid
import re

from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from django.utils import timezone

User = settings.AUTH_USER_MODEL


# =========================================================
# MODULES (Feature Flags)
# =========================================================

class Module(models.Model):
    """
    Feature flags - which major modules this school has activated
    Example:
        students
        finance
        academics
        hr
        transport
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)

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
        ('YEAR_SEQ', 'Year + Sequential (2026-0001)'),
        ('PREFIX_YEAR_SEQ', 'Prefix + Year + Sequential (ABC-2026-0001)'),
        ('CUSTOM', 'Manual Entry'),
    ]

    admission_number_format = models.CharField(
        max_length=20,
        choices=ADMISSION_NUMBER_FORMAT_CHOICES,
        default='YEAR_SEQ'
    )

    admission_prefix = models.CharField(
        max_length=20,
        blank=True
    )

    admission_seq_padding = models.PositiveSmallIntegerField(
        default=4
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



# =========================================================
# ADMISSION NUMBER GENERATOR
# =========================================================

def generate_unique_admission_number(school):
    """
    Generates unique admission number per school.
    Safe for concurrent requests.
    """

    from apps.admissions.models import Application
    from apps.students.models import Student

    if not school.admission_number_format:
        raise ValidationError(
            "Admission format not configured."
        )

    current_year = timezone.now().year

    prefix = (school.admission_prefix or "").strip()

    padding = school.admission_seq_padding or 4

    format_type = school.admission_number_format


    with transaction.atomic():

        School.objects.select_for_update().filter(
            pk=school.pk
        ).first()

        existing_numbers = set()

        apps = Application.objects.filter(
            school=school,
            admission_number__startswith=str(current_year)
        ).values_list(
            "admission_number",
            flat=True
        )

        students = Student.objects.filter(
            school=school,
            admission_number__startswith=str(current_year)
        ).values_list(
            "admission_number",
            flat=True
        )

        existing_numbers.update(apps)
        existing_numbers.update(students)

        max_seq = 0

        for num in existing_numbers:

            try:
                seq_part = num.split("-")[-1]
                seq = int(seq_part)

                if seq > max_seq:
                    max_seq = seq

            except:
                continue


        while True:

            next_seq = max_seq + 1

            seq_str = f"{next_seq:0{padding}d}"


            if format_type == "YEAR_SEQ":

                candidate = f"{current_year}-{seq_str}"

            elif format_type == "PREFIX_YEAR_SEQ":

                if not prefix:
                    raise ValidationError(
                        "Prefix required."
                    )

                candidate = f"{prefix}-{current_year}-{seq_str}"

            else:

                raise ValidationError(
                    "Unsupported format."
                )


            if (
                not Application.objects.filter(
                    school=school,
                    admission_number=candidate
                ).exists()

                and

                not Student.objects.filter(
                    school=school,
                    admission_number=candidate
                ).exists()
            ):

                return candidate

            max_seq = next_seq