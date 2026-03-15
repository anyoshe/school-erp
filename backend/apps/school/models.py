# schools/models.py
import uuid
from django.db import models
from datetime import datetime
from django.db.models import Max
from django.core.exceptions import ValidationError
from django.db import transaction
from django.conf import settings
from django.utils.text import slugify 
import re

User = settings.AUTH_USER_MODEL


class Module(models.Model):
    """
    Feature flags - which major modules this school has activated
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)  # e.g. 'students', 'finance'

    def __str__(self):
        return self.name


class School(models.Model):
    """
    Main tenant entity - represents one school/institution
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)
    alternative_phone = models.CharField(max_length=20, blank=True, verbose_name="Alternative Phone")
    emergency_phone = models.CharField(max_length=20, blank=True, verbose_name="Emergency Phone")
    postal_address = models.TextField(blank=True, verbose_name="Postal Address")
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default="Kenya")
    website = models.URLField(blank=True)
    logo = models.ImageField(upload_to="school_logos/", blank=True, null=True)
    CURRENCY_CHOICES = [
        ("KES", "Kenyan Shilling"),
        ("USD", "US Dollar"),
        ("EUR", "Euro"),
        ("GBP", "British Pound"),
        ("UGX", "Ugandan Shilling"),
        ("TZS", "Tanzanian Shilling"),
        ("RWF", "Rwandan Franc"),
        ("NGN", "Nigerian Naira"),
        # Add more as your platform grows
    ]

    currency = models.CharField(
        max_length=10,
        choices=CURRENCY_CHOICES,
        default="KES",
        help_text="Primary currency for fees, invoices, payments"
    )

    currency_symbol = models.CharField(
        max_length=8,
        blank=True,
        default="KSh",
        help_text="Display symbol (e.g. KSh, $, €, £, UGX). Leave blank to use code."
    )

    # Helper property for display
    @property
    def currency_display(self):
        return self.currency_symbol.strip() or self.currency
    # Official registration details
    official_registration_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Official Registration / Licence Number",
        help_text="Enter the official registration number issued by your country's education authority (MOE, KNEC, State Board, etc.)"
    )

    registration_authority = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Issuing Authority",
        help_text="e.g. Ministry of Education, State Board of Education, Private Schools Regulatory Authority, etc."
    )

    registration_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Registration Date"
    )
    
    # School-wide academic defaults (can be overridden per curriculum)
    academic_year_start_month = models.CharField(
        max_length=20, 
        default="January",
        help_text="Start month of academic year"
    )
    academic_year_end_month = models.CharField(
        max_length=20, 
        default="December",
        help_text="End month of academic year"
    )
    term_system = models.CharField(max_length=20, default="terms")  # terms / semesters
    number_of_terms = models.PositiveIntegerField(default=3)
    grading_system = models.CharField(max_length=20, default="percentage")
    passing_mark = models.PositiveIntegerField(default=50)

    # ── NEW: Admission Number Configuration ───────────────────────────────
    ADMISSION_NUMBER_FORMAT_CHOICES = [
        ('YEAR_SEQ', 'Year + Sequential (2026-0001)'),
        ('PREFIX_YEAR_SEQ', 'Prefix + Year + Sequential (ABC-2026-0001)'),
        ('CUSTOM', 'Manual entry (admin enters number)'),
    ]

    admission_number_format = models.CharField(
        max_length=20,
        choices=ADMISSION_NUMBER_FORMAT_CHOICES,
        default='YEAR_SEQ',
        verbose_name="Admission Number Format",
        help_text="How admission/application numbers should be generated for this school"
    )

    admission_prefix = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Admission Number Prefix",
        help_text="Optional prefix (e.g. 'KCB-', 'INT-', 'SCH-'). Only used if format includes prefix."
    )

    admission_seq_padding = models.PositiveSmallIntegerField(
        default=4,
        verbose_name="Sequence Number Padding",
        help_text="Number of digits for the sequential part (e.g. 4 → 0001, 5 → 00001)"
    )
    # ────────────────────────────────────────────────────────────────────────

    # Activated features/modules
    modules = models.ManyToManyField(Module, blank=True, related_name="schools")

    # Access control
    owner = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="owned_schools"
    )
    users = models.ManyToManyField(User, blank=True, related_name="schools")

    setup_complete = models.BooleanField(default=False)  # Wizard finished?

    slug = models.SlugField(
        max_length=100,
        unique=True,
        blank=True,          # allow blank so old records don't break
        null=True,           # allow null for old records during migration
        help_text="Auto-generated from name (used in public URLs)"
    )

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            # Clean name for better slug
            name_clean = re.sub(r'\s*\([^)]*\)', '', self.name)     # remove (SMSS)
            name_clean = re.sub(r'\.', '', name_clean)               # remove dots
            name_clean = name_clean.strip().lower()
            
            base_slug = slugify(name_clean)
            
            # Avoid duplicates
            slug = base_slug
            counter = 1
            while School.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            self.slug = slug[:100]  # respect max_length

        super().save(*args, **kwargs)
    # ── NEW: Financial & Banking Details ───────────────────────────────
    bank_name = models.CharField(
        max_length=100, 
        blank=True, 
        help_text="e.g. KCB, Equity, Co-operative Bank"
    )
    branch_name = models.CharField(
        max_length=100, 
        blank=True, 
        help_text="e.g. Westlands Branch"
    )
    bank_account_name = models.CharField(
        max_length=255, 
        blank=True, 
        help_text="Official name as it appears in the bank"
    )
    bank_account_number = models.CharField(
        max_length=50, 
        blank=True
    )
    paybill_number = models.CharField(
        max_length=50, 
        blank=True, 
        verbose_name="M-Pesa Paybill / Till Number"
    )
    payment_instructions = models.TextField(
        blank=True, 
        help_text="Additional notes like: 'Please use student name as reference'"
    )
    # ──────────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.short_name or self.name
    


def generate_unique_admission_number(school):
    """
    Generates a unique admission number using the school's configured format.
    
    Uses existing School fields:
    - admission_number_format (YEAR_SEQ, PREFIX_YEAR_SEQ, CUSTOM)
    - admission_prefix (optional)
    - admission_seq_padding (number of digits, default 4)
    
    Returns a string like:
    - YEAR_SEQ:        "2026-0001"
    - PREFIX_YEAR_SEQ: "SFPS-2026-0001"
    - CUSTOM:          raises ValidationError (admin must enter manually)
    """
    if not school.admission_number_format:
        raise ValidationError("School has no admission number format configured.")

    current_year = datetime.now().year
    prefix = (school.admission_prefix or "").strip()
    padding = school.admission_seq_padding or 4

    format_type = school.admission_number_format

    with transaction.atomic():  # Prevent race conditions in concurrent requests
        # Get highest sequence for this school + year
        # We filter by admission_date__year to separate per-year sequences
        last_admission = Student.objects.filter(
            school=school,
            admission_date__year=current_year
        ).order_by('-admission_number').first()

        if last_admission and last_admission.admission_number:
            try:
                # Extract the numeric sequence part (last segment after '-')
                last_seq_str = last_admission.admission_number.split('-')[-1]
                last_seq = int(last_seq_str)
                new_seq = last_seq + 1
            except (ValueError, IndexError):
                new_seq = 1
        else:
            new_seq = 1

        seq_str = f"{new_seq:0{padding}d}"  # e.g. "0001", "00123"

        if format_type == 'YEAR_SEQ':
            return f"{current_year}-{seq_str}"

        elif format_type == 'PREFIX_YEAR_SEQ':
            if not prefix:
                raise ValidationError(
                    "Prefix is required for PREFIX_YEAR_SEQ format. "
                    "Please set admission_prefix on the school."
                )
            return f"{prefix}-{current_year}-{seq_str}"

        elif format_type == 'CUSTOM':
            raise ValidationError(
                "School uses CUSTOM admission number format. "
                "Admission number must be entered manually by an admin."
            )

        else:
            raise ValidationError(f"Unknown admission number format: {format_type}")