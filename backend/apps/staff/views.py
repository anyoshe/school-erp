from datetime import date

from django.db.models import Q
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from apps.school.support import accessible_school_ids, selected_school
from .models import Staff, Payroll
from .serializers import (
    StaffSerializer,
    StaffWriteSerializer,
    PayrollSerializer,
    PayrollCreateUpdateSerializer,
)


class StaffViewSet(ModelViewSet):
    queryset = Staff.objects.select_related("user").all()
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = self.queryset.filter(school_id__in=accessible_school_ids(self.request))
        role = self.request.query_params.get("role")
        active = self.request.query_params.get("is_active")
        q = self.request.query_params.get("q") or self.request.query_params.get("search")
        if role:
            qs = qs.filter(role=role.upper())
        if active is not None and active != "":
            qs = qs.filter(is_active=str(active).lower() in ("1", "true", "yes"))
        if q:
            qs = qs.filter(
                Q(user__first_name__icontains=q)
                | Q(user__last_name__icontains=q)
                | Q(user__email__icontains=q)
                | Q(phone__icontains=q)
                | Q(employee_number__icontains=q)
                | Q(department__icontains=q)
                | Q(job_title__icontains=q)
            )
        return qs.order_by("user__last_name", "user__first_name", "user__email")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return StaffWriteSerializer
        return StaffSerializer

    def create(self, request, *args, **kwargs):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        ser = StaffWriteSerializer(
            data=request.data, context={"school": school, "request": request}
        )
        ser.is_valid(raise_exception=True)
        staff = ser.save()
        return Response(StaffSerializer(staff).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        school = selected_school(request)
        ser = StaffWriteSerializer(
            instance,
            data=request.data,
            partial=partial,
            context={"school": school, "request": request},
        )
        ser.is_valid(raise_exception=True)
        staff = ser.save()
        return Response(StaffSerializer(staff).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="sync-teachers")
    def sync_teachers(self, request):
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
                    "is_active": True,
                },
            )
            if not was_created:
                existing += 1
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
        teachers = Staff.objects.filter(
            school=school, role=Staff.Role.TEACHER, is_active=True
        ).select_related("user")
        return Response(
            {
                "created": created,
                "existing": existing,
                "teachers": StaffSerializer(teachers, many=True).data,
            }
        )

    @action(detail=False, methods=["get"], url_path="teachers")
    def teachers(self, request):
        """Active teachers for academics allocation and other modules."""
        qs = self.get_queryset().filter(role=Staff.Role.TEACHER, is_active=True)
        return Response(StaffSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        by_role = {}
        for role, label in Staff.Role.choices:
            by_role[role] = qs.filter(role=role).count()
        return Response(
            {
                "total": qs.count(),
                "active": qs.filter(is_active=True).count(),
                "teachers": qs.filter(role=Staff.Role.TEACHER, is_active=True).count(),
                "by_role": by_role,
            }
        )


class PayrollViewSet(ModelViewSet):
    queryset = Payroll.objects.select_related("staff__user").all().order_by("-month")
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(
            staff__school_id__in=accessible_school_ids(self.request)
        )

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if serializer.validated_data["staff"].school_id != school.id:
            raise PermissionDenied(
                "Payroll records must belong to the selected school's staff."
            )
        serializer.save()

    def perform_update(self, serializer):
        school = selected_school(self.request)
        if (
            serializer.validated_data.get("staff", serializer.instance.staff).school_id
            != school.id
        ):
            raise PermissionDenied(
                "Payroll records must belong to the selected school's staff."
            )
        serializer.save()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return PayrollCreateUpdateSerializer
        return PayrollSerializer
