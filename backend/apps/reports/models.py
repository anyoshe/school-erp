# reports/models.py
import uuid
from django.db import models
from apps.accounts.models import User
from apps.school.models import School

class Report(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    school = models.ForeignKey(
        School,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
    )

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.name} ({self.generated_at.date()})"
