# attendance/models.py
import uuid
from django.db import models
from apps.accounts.models import User

class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "PRESENT"
        ABSENT = "ABSENT"
        LATE = "LATE"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField()
    # Phase-4-ready school FK
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="attendance_recorded")
    
    class Meta:
        unique_together = ("user", "date")