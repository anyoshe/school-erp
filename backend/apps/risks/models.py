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
