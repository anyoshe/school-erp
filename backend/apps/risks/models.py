import uuid

from django.conf import settings
from django.db import models


class RiskAlert(models.Model):
    """Proactive operational risk flag for school owners (not a historical report)."""

    class Category(models.TextChoices):
        FEE = "FEE", "Fee / revenue"
        ATTENDANCE = "ATTENDANCE", "Attendance / retention"
        ACADEMIC = "ACADEMIC", "Academic trajectory"
        OPS = "OPS", "Operations"

    class Severity(models.TextChoices):
        HIGH = "HIGH", "High"
        MEDIUM = "MEDIUM", "Medium"
        LOW = "LOW", "Low"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        ACKNOWLEDGED = "ACKNOWLEDGED", "Acknowledged"
        RESOLVED = "RESOLVED", "Resolved"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        "school.School",
        on_delete=models.CASCADE,
        related_name="risk_alerts",
    )
    category = models.CharField(max_length=20, choices=Category.choices, db_index=True)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)

    # Stable key so rescans upsert instead of duplicating (e.g. fee:overdue:<student_id>)
    fingerprint = models.CharField(max_length=180, db_index=True)

    title = models.CharField(max_length=200)
    detail = models.TextField(blank=True)
    metrics = models.JSONField(default=dict, blank=True)

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="risk_alerts",
    )
    # Optional deep-link path for the frontend (relative)
    action_path = models.CharField(max_length=255, blank=True)

    detected_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="acknowledged_risks",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-severity", "-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "fingerprint"],
                name="risks_alert_unique_fingerprint_per_school",
            ),
        ]
        indexes = [
            models.Index(fields=["school", "status", "category"]),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.category}: {self.title}"


class RiskDigestLog(models.Model):
    """Record of a morning risk digest sent (or dry-run logged) for a school."""

    class Channel(models.TextChoices):
        LOG = "LOG", "Log only"
        WHATSAPP = "WHATSAPP", "WhatsApp"
        EMAIL = "EMAIL", "Email"
        BOTH = "BOTH", "WhatsApp + Email"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        "school.School",
        on_delete=models.CASCADE,
        related_name="risk_digests",
    )
    digest_date = models.DateField(db_index=True)
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.LOG)
    alert_count = models.PositiveIntegerField(default=0)
    high_count = models.PositiveIntegerField(default=0)
    message_preview = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    ok = models.BooleanField(default=True)
    detail = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-digest_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "digest_date", "channel"],
                name="risks_digest_unique_school_date_channel",
            ),
        ]

    def __str__(self):
        return f"Digest {self.school_id} {self.digest_date} ({self.channel})"


class SchoolRiskSettings(models.Model):
    """Per-school thresholds and feature toggles for the early-warning engine (R7)."""

    school = models.OneToOneField(
        "school.School",
        on_delete=models.CASCADE,
        related_name="risk_settings",
        primary_key=True,
    )
    # Feature toggles
    enable_fee = models.BooleanField(default=True)
    enable_attendance = models.BooleanField(default=True)
    enable_academic = models.BooleanField(default=True)
    enable_ops = models.BooleanField(default=True)
    # Fee
    mid_term_collection_threshold = models.DecimalField(
        max_digits=4, decimal_places=2, default=0.40,
        help_text="Flag when paid/due is below this ratio mid-term (e.g. 0.40 = 40%)",
    )
    mid_term_elapsed_threshold = models.DecimalField(
        max_digits=4, decimal_places=2, default=0.40,
        help_text="Only apply mid-term lag after this fraction of the term has elapsed",
    )
    # Attendance
    consecutive_absent_days = models.PositiveSmallIntegerField(default=3)
    mon_fri_absent_count = models.PositiveSmallIntegerField(default=3)
    chronic_absent_60d = models.PositiveSmallIntegerField(default=7)
    absence_rate_window_days = models.PositiveSmallIntegerField(default=15)
    absence_rate_delta = models.DecimalField(
        max_digits=4, decimal_places=2, default=0.15,
        help_text="Minimum rise in absence rate (e.g. 0.15 = +15 points)",
    )
    # Academic
    cat_drop_points = models.DecimalField(
        max_digits=5, decimal_places=2, default=15,
        help_text="Point drop from first to latest CAT that triggers trajectory risk",
    )
    # Ops
    burn_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.25)
    burn_window_days = models.PositiveSmallIntegerField(default=7)
    # Digest defaults
    digest_channel = models.CharField(
        max_length=20,
        default="LOG",
        help_text="LOG | WHATSAPP | EMAIL | BOTH",
    )
    digest_limit = models.PositiveSmallIntegerField(default=5)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Risk settings · {self.school_id}"
