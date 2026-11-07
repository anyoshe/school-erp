# attendance/models.py
import uuid
from django.db import models
from apps.accounts.models import User
from apps.school.models import School


class Attendance(models.Model):
    """Legacy staff/user attendance (kept for compatibility)."""

    class Status(models.TextChoices):
        PRESENT = "PRESENT"
        ABSENT = "ABSENT"
        LATE = "LATE"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    school = models.ForeignKey(
        School,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attendance_records",
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices)
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="attendance_recorded"
    )

    class Meta:
        unique_together = ("school", "user", "date")


class StudentAttendance(models.Model):
    """Daily learner attendance — primary school attendance model."""

    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        LATE = "LATE", "Late"
        EXCUSED = "EXCUSED", "Excused"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="student_attendance",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PRESENT,
    )
    notes = models.CharField(max_length=255, blank=True)

    # Snapshot of placement on that day (helps historical reports)
    grade_level = models.ForeignKey(
        "academics.GradeLevel",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )

    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_attendance_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("school", "student", "date")
        ordering = ["-date", "student__last_name"]
        indexes = [
            models.Index(fields=["school", "date"]),
            models.Index(fields=["school", "grade_level", "date"]),
        ]

    def __str__(self):
        return f"{self.student_id} {self.date} {self.status}"


class AttendanceAlert(models.Model):
    """Log of WhatsApp/SMS alerts sent for attendance events."""

    class Channel(models.TextChoices):
        WHATSAPP = "WHATSAPP", "WhatsApp"
        SMS = "SMS", "SMS"
        LOG = "LOG", "Log only"

    class Outcome(models.TextChoices):
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"
        SKIPPED = "SKIPPED", "Skipped"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="attendance_alerts")
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="attendance_alerts",
    )
    attendance = models.ForeignKey(
        StudentAttendance,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    date = models.DateField()
    channel = models.CharField(max_length=12, choices=Channel.choices, default=Channel.WHATSAPP)
    phone = models.CharField(max_length=32, blank=True)
    message = models.TextField(blank=True)
    outcome = models.CharField(max_length=12, choices=Outcome.choices, default=Outcome.SKIPPED)
    detail = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
