from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Attendance
from .serializers import AttendanceSerializer, AttendanceCreateUpdateSerializer

# ----------------------------
# ATTENDANCE VIEWSET
# ----------------------------
class AttendanceViewSet(ModelViewSet):
    queryset = Attendance.objects.select_related('user', 'recorded_by').all().order_by('-date')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """
        Use separate serializers for read vs write
        """
        if self.action in ['create', 'update', 'partial_update']:
            return AttendanceCreateUpdateSerializer
        return AttendanceSerializer
