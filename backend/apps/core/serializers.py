from rest_framework import serializers
from .models import AuditLog, SyncQueue
from apps.accounts.serializers import UserSerializer

# ----------------------------
# AUDIT LOG SERIALIZERS
# ----------------------------

class AuditLogSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes user email
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user',
            'user_email',
            'action',
            'table_name',
            'record_id',
            'timestamp'
        ]


class AuditLogCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: Typically used internally for logging
    """
    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user',
            'action',
            'table_name',
            'record_id'
        ]


# ----------------------------
# SYNC QUEUE SERIALIZERS
# ----------------------------

class SyncQueueSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Shows sync queue entries
    """
    class Meta:
        model = SyncQueue
        fields = [
            'id',
            'record_type',
            'record_id',
            'operation',
            'synced',
            'created_at'
        ]


class SyncQueueCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For managing sync operations
    """
    class Meta:
        model = SyncQueue
        fields = [
            'id',
            'record_type',
            'record_id',
            'operation',
            'synced'
        ]
