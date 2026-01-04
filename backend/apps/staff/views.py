from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Staff, Payroll
from .serializers import (
    StaffSerializer,
    StaffCreateUpdateSerializer,
    PayrollSerializer,
    PayrollCreateUpdateSerializer
)

# ----------------------------
# STAFF VIEWSET
# ----------------------------
class StaffViewSet(ModelViewSet):
    queryset = Staff.objects.select_related('user').all().order_by('user__email')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StaffCreateUpdateSerializer
        return StaffSerializer


# ----------------------------
# PAYROLL VIEWSET
# ----------------------------
class PayrollViewSet(ModelViewSet):
    queryset = Payroll.objects.select_related('staff__user').all().order_by('-month')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PayrollCreateUpdateSerializer
        return PayrollSerializer
