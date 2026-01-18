# schools/models.py
import uuid
from django.db import models
from django.conf import settings

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
    currency = models.CharField(max_length=10, default="KES")
    
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
    academic_year_start_month = models.CharField(max_length=20, default="January")
    academic_year_end_month = models.CharField(max_length=20, default="December")
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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.short_name or self.name