from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import AuditLog, SyncQueue
from .serializers import (
    AuditLogSerializer,
    AuditLogCreateUpdateSerializer,
    SyncQueueSerializer,
    SyncQueueCreateUpdateSerializer
)
from apps.school.support import accessible_school_ids, selected_school

# ----------------------------
# AUDIT LOG VIEWSET
# ----------------------------
class AuditLogViewSet(ModelViewSet):
    queryset = AuditLog.objects.select_related('user').all().order_by('-timestamp')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), user=self.request.user)

    def get_serializer_class(self):
        """
        Use read-only serializer for list/retrieve, write serializer for create/update
        """
        if self.action in ['create', 'update', 'partial_update']:
            return AuditLogCreateUpdateSerializer
        return AuditLogSerializer


# ----------------------------
# SYNC QUEUE VIEWSET
# ----------------------------
class SyncQueueViewSet(ModelViewSet):
    queryset = SyncQueue.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

    def get_serializer_class(self):
        """
        Use read-only serializer for list/retrieve, write serializer for create/update
        """
        if self.action in ['create', 'update', 'partial_update']:
            return SyncQueueCreateUpdateSerializer
        return SyncQueueSerializer
