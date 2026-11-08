from datetime import date

from django.db.models import Q, Sum, Count
from django.utils import timezone
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.school.support import accessible_school_ids, selected_school
from .models import Staff, Payroll, LeaveRequest
from .serializers import (
    StaffSerializer,
    StaffWriteSerializer,
    PayrollSerializer,
    PayrollCreateUpdateSerializer,
    LeaveRequestSerializer,
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
                | Q(national_id__icontains=q)
                | Q(tsc_number__icontains=q)
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
                if obj.school_id != school.id:
                    obj.school = school
                    obj.save(update_fields=["school"])
            else:
                created += 1
        return Response({"created": created, "existing": existing})

    @action(detail=False, methods=["get"], url_path="teachers")
    def teachers(self, request):
        qs = self.get_queryset().filter(role=Staff.Role.TEACHER, is_active=True)
        return Response(StaffSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        by_role = {role: qs.filter(role=role).count() for role, _ in Staff.Role.choices}
        on_leave = (
            LeaveRequest.objects.filter(
                school_id__in=accessible_school_ids(request),
                status=LeaveRequest.Status.APPROVED,
                start_date__lte=date.today(),
                end_date__gte=date.today(),
            )
            .values("staff_id")
            .distinct()
            .count()
        )
        return Response(
            {
                "total": qs.count(),
                "active": qs.filter(is_active=True).count(),
                "teachers": qs.filter(role=Staff.Role.TEACHER, is_active=True).count(),
                "on_leave_today": on_leave,
                "by_role": by_role,
            }
        )

    @action(detail=True, methods=["get"], url_path="teaching-load")
    def teaching_load(self, request, pk=None):
        staff = self.get_object()
        from apps.academics.models import SubjectTeacher, Section
        from apps.academics.serializers import SubjectTeacherSerializer, SectionSerializer

        assigns = (
            SubjectTeacher.objects.filter(teacher=staff, is_active=True)
            .select_related("subject", "grade_level", "academic_year")
            .order_by("academic_year__name", "grade_level__order", "subject__name")
        )
        sections = (
            Section.objects.filter(class_teacher=staff, is_active=True)
            .select_related("grade_level", "class_teacher", "class_teacher__user")
            .order_by("grade_level__order", "name")
        )
        return Response(
            {
                "staff_id": str(staff.id),
                "subject_assignments": SubjectTeacherSerializer(assigns, many=True).data,
                "class_sections": SectionSerializer(sections, many=True).data,
            }
        )


class PayrollViewSet(ModelViewSet):
    queryset = Payroll.objects.select_related("staff__user").all().order_by("-month")
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = self.queryset.filter(staff__school_id__in=accessible_school_ids(self.request))
        staff_id = self.request.query_params.get("staff")
        month = self.request.query_params.get("month")
        status = self.request.query_params.get("status")
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        if month:
            qs = qs.filter(month__startswith=str(month)[:7])
        if status:
            qs = qs.filter(status=status.upper())
        return qs

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if not school:
            raise ValidationError({"detail": "No school selected"})
        if serializer.validated_data["staff"].school_id != school.id:
            raise PermissionDenied("Payroll must belong to the selected school's staff.")
        serializer.save()

    def perform_update(self, serializer):
        school = selected_school(self.request)
        staff = serializer.validated_data.get("staff", serializer.instance.staff)
        if staff.school_id != school.id:
            raise PermissionDenied("Payroll must belong to the selected school's staff.")
        serializer.save()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return PayrollCreateUpdateSerializer
        return PayrollSerializer

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        month = request.query_params.get("month")
        if month:
            qs = qs.filter(month__startswith=str(month)[:7])
        agg = qs.aggregate(
            total_net=Sum("net_salary"),
            total_basic=Sum("basic_salary"),
            count=Count("id"),
        )
        by_status = {
            s: qs.filter(status=s).count() for s, _ in Payroll.Status.choices
        }
        return Response({**agg, "by_status": by_status})

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        row = self.get_object()
        row.status = Payroll.Status.PAID
        row.paid_at = request.data.get("paid_at") or date.today()
        row.save()
        return Response(PayrollSerializer(row).data)


class LeaveRequestViewSet(ModelViewSet):
    queryset = LeaveRequest.objects.select_related("staff__user", "reviewed_by").all()
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    pagination_class = None

    def get_queryset(self):
        qs = self.queryset.filter(school_id__in=accessible_school_ids(self.request))
        status = self.request.query_params.get("status")
        staff_id = self.request.query_params.get("staff")
        if status:
            qs = qs.filter(status=status.upper())
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        return qs

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if not school:
            raise ValidationError({"detail": "No school selected"})
        staff = serializer.validated_data["staff"]
        if staff.school_id != school.id:
            raise PermissionDenied("Staff must belong to the selected school")
        start = serializer.validated_data["start_date"]
        end = serializer.validated_data["end_date"]
        if end < start:
            raise ValidationError({"end_date": "End date must be on or after start date"})
        days = serializer.validated_data.get("days") or ((end - start).days + 1)
        serializer.save(school=school, days=days, status=LeaveRequest.Status.PENDING)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        leave = self.get_object()
        leave.status = LeaveRequest.Status.APPROVED
        leave.reviewed_by = request.user
        leave.reviewed_at = timezone.now()
        leave.review_notes = (request.data.get("review_notes") or "")[:255]
        leave.save()
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        leave = self.get_object()
        leave.status = LeaveRequest.Status.REJECTED
        leave.reviewed_by = request.user
        leave.reviewed_at = timezone.now()
        leave.review_notes = (request.data.get("review_notes") or "")[:255]
        leave.save()
        return Response(LeaveRequestSerializer(leave).data)
