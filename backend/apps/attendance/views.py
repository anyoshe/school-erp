from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Attendance
from .serializers import AttendanceSerializer, AttendanceCreateUpdateSerializer
from apps.school.support import accessible_school_ids, selected_school
from rest_framework.exceptions import PermissionDenied

# ----------------------------
# ATTENDANCE VIEWSET
# ----------------------------
class AttendanceViewSet(ModelViewSet):
    queryset = Attendance.objects.select_related('user', 'recorded_by').all().order_by('-date')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if not school.users.filter(pk=serializer.validated_data["user"].pk).exists():
            raise PermissionDenied("Attendance can only be marked for a user in this school.")
        serializer.save(school=school, recorded_by=self.request.user)

    def perform_update(self, serializer):
        school = selected_school(self.request)
        if not school.users.filter(
            pk=serializer.validated_data.get("user", serializer.instance.user).pk
        ).exists():
            raise PermissionDenied("Attendance can only be marked for a user in this school.")
        serializer.save(school=school, recorded_by=self.request.user)

    def get_serializer_class(self):
        """
        Use separate serializers for read vs write
        """
        if self.action in ['create', 'update', 'partial_update']:
            return AttendanceCreateUpdateSerializer
        return AttendanceSerializer
