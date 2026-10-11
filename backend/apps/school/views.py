from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from uuid import UUID
from .models import School, Module, SchoolSupportAuditLog, SchoolSupportSession
from .serializers import (
    SchoolSerializer,
    SchoolCreateUpdateSerializer,
    ModuleSerializer,
    SchoolMiniSerializer,
    PlatformSchoolSerializer,
)
from .module_seed import seed_default_modules
from apps.core.permissions import IsAssociatedWithSchool
from .permissions import IsPlatformSuperuser
from .support import active_support_session, accessible_school_ids, close_support_sessions

class ModuleViewSet(ModelViewSet):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get']  # read-only is perfect

    def get_queryset(self):
        seed_default_modules()
        return Module.objects.all()


class SchoolViewSet(ModelViewSet):
    """
    Manage schools with multi-tenancy enforcement.
    """
    queryset = School.objects.prefetch_related('modules').all().order_by('name')
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get_permissions(self):
        if self.action in {"platform_directory", "start_support_context", "end_support_context", "support_context"}:
            return [IsAuthenticated(), IsPlatformSuperuser()]
        return super().get_permissions()

    def get_queryset(self):
        return self.queryset.filter(pk__in=accessible_school_ids(self.request))

    def get_serializer_class(self):
        if self.action == "platform_directory":
            return PlatformSchoolSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return SchoolCreateUpdateSerializer
        return SchoolSerializer
   
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        """
        Create a new school and automatically associate the current user.
        """
        if self.request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Platform administrators cannot create schools through onboarding.")
        school = serializer.save(owner=self.request.user)
        school.users.add(self.request.user)
        return school
        
    
    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        school = self.get_queryset().order_by('-updated_at', '-created_at').first()

        if not school:
            return Response({"detail": "No active school found."}, status=404)
    
    # Use Mini serializer for consistency (smaller payload + logo)
        serializer = SchoolMiniSerializer(school)
        return Response(serializer.data)
    @action(detail=False, methods=['get'], url_path='my-schools',
            permission_classes=[IsAuthenticated])
    def my_schools(self, request):
        if request.user.is_superuser:
            schools = self.get_queryset()
        else:
            schools = School.objects.filter(
                Q(owner=request.user) | Q(users=request.user)
            ).distinct().order_by('name')
        serializer = SchoolSerializer(schools, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="platform-directory")
    def platform_directory(self, request):
        schools = School.objects.all().order_by("name")
        search = request.query_params.get("search", "").strip()
        if search:
            schools = schools.filter(
                Q(name__icontains=search)
                | Q(short_name__icontains=search)
                | Q(email__icontains=search)
                | Q(city__icontains=search)
                | Q(country__icontains=search)
            )
        return Response(PlatformSchoolSerializer(schools, many=True).data)

    @action(detail=False, methods=["post"], url_path="start-support-context")
    def start_support_context(self, request):
        school_id = request.data.get("school_id")
        reason = request.data.get("reason")
        if not school_id:
            return Response({"detail": "school_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            school_id = UUID(str(school_id))
        except (TypeError, ValueError):
            return Response({"detail": "school_id must be a valid UUID."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(reason, str) or not reason.strip():
            return Response({"detail": "A support reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        reason = reason.strip()
        school = get_object_or_404(School, pk=school_id)

        with transaction.atomic():
            type(request.user).objects.select_for_update().get(pk=request.user.pk)
            close_support_sessions(request.user, action="context_switched")
            support_session = SchoolSupportSession.objects.create(
                administrator=request.user,
                school=school,
                reason=reason[:500],
            )
            SchoolSupportAuditLog.objects.create(
                administrator=request.user,
                school=school,
                support_session=support_session,
                action="context_started",
            )
        return Response({
            "id": str(support_session.id),
            "school": PlatformSchoolSerializer(school).data,
            "started_at": support_session.started_at,
            "read_only": True,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="end-support-context")
    def end_support_context(self, request):
        support_session = active_support_session(request.user)
        if support_session:
            support_session.ended_at = timezone.now()
            support_session.save(update_fields=["ended_at"])
            SchoolSupportAuditLog.objects.create(
                administrator=request.user,
                school=support_session.school,
                support_session=support_session,
                action="context_ended",
            )
        return Response({"detail": "School-support context ended."})

    @action(detail=False, methods=["get"], url_path="support-context")
    def support_context(self, request):
        support_session = active_support_session(request.user)
        if not support_session:
            return Response({"active": False, "school": None})
        return Response({
            "active": True,
            "id": str(support_session.id),
            "school": PlatformSchoolSerializer(support_session.school).data,
            "started_at": support_session.started_at,
            "read_only": True,
        })
