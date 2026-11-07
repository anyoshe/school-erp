from datetime import date
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
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
        qs = self.queryset.filter(school_id__in=accessible_school_ids(self.request))
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role.upper())
        return qs

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


    @action(detail=False, methods=["post"], url_path="sync-teachers")
    def sync_teachers(self, request):
        """
        Ensure every school user with role TEACHER has a Staff profile.
        Creates missing Staff rows so allocation dropdowns are usable.
        """
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        from apps.accounts.models import User

        users = school.users.filter(role=User.Role.TEACHER)
        created = 0
        existing = 0
        for user in users:
            obj, was_created = Staff.objects.get_or_create(
                user=user,
                defaults={
                    "school": school,
                    "role": Staff.Role.TEACHER,
                    "hire_date": date.today(),
                },
            )
            if not was_created:
                existing += 1
                # keep school/role aligned
                updates = []
                if obj.school_id != school.id:
                    obj.school = school
                    updates.append("school")
                if obj.role != Staff.Role.TEACHER:
                    obj.role = Staff.Role.TEACHER
                    updates.append("role")
                if updates:
                    obj.save(update_fields=updates)
            else:
                created += 1
        teachers = Staff.objects.filter(school=school, role=Staff.Role.TEACHER).select_related("user")
        return Response({
            "created": created,
            "existing": existing,
            "teachers": StaffSerializer(teachers, many=True).data,
        })

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
