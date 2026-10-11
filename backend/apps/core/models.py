# core/models.py
import uuid
from django.db import models
from apps.accounts.models import User
from apps.school.models import School

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=50)
    table_name = models.CharField(max_length=50)
    record_id = models.UUIDField()
    timestamp = models.DateTimeField(auto_now_add=True)
    school = models.ForeignKey(
        School,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="system_audit_logs",
    )

class SyncQueue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record_type = models.CharField(max_length=50)
    record_id = models.UUIDField()
    operation = models.CharField(max_length=20)  # CREATE / UPDATE / DELETE
    synced = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    school = models.ForeignKey(
        School,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sync_queue_entries",
    )
