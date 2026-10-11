from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Staff, Payroll
from .serializers import (
    StaffSerializer,
    StaffCreateUpdateSerializer,
    PayrollSerializer,
    PayrollCreateUpdateSerializer
)
from apps.school.support import accessible_school_ids, selected_school
from rest_framework.exceptions import PermissionDenied

# ----------------------------
# STAFF VIEWSET
# ----------------------------
class StaffViewSet(ModelViewSet):
    queryset = Staff.objects.select_related('user').all().order_by('user__email')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if not school.users.filter(pk=serializer.validated_data["user"].pk).exists():
            raise PermissionDenied("Staff users must belong to the selected school.")
        serializer.save(school=school)

    def perform_update(self, serializer):
        school = selected_school(self.request)
        if not school.users.filter(pk=serializer.validated_data.get("user", serializer.instance.user).pk).exists():
            raise PermissionDenied("Staff users must belong to the selected school.")
        serializer.save(school=school)

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

    def get_queryset(self):
        return self.queryset.filter(staff__school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if serializer.validated_data["staff"].school_id != school.id:
            raise PermissionDenied("Payroll records must belong to the selected school's staff.")
        serializer.save()

    def perform_update(self, serializer):
        school = selected_school(self.request)
        if serializer.validated_data.get("staff", serializer.instance.staff).school_id != school.id:
            raise PermissionDenied("Payroll records must belong to the selected school's staff.")
        serializer.save()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PayrollCreateUpdateSerializer
        return PayrollSerializer
