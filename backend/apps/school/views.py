from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from .models import School, Module
from .serializers import SchoolSerializer, SchoolCreateUpdateSerializer, ModuleSerializer, SchoolMiniSerializer
from apps.core.permissions import IsAssociatedWithSchool

class ModuleViewSet(ModelViewSet):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get']  # read-only is perfect


class SchoolViewSet(ModelViewSet):
    """
    Manage schools with multi-tenancy enforcement.
    """
    queryset = School.objects.prefetch_related('modules').all().order_by('name')
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    # def get_serializer_class(self):
    #     if self.action in ['create', 'update', 'partial_update']:
    #         return SchoolCreateUpdateSerializer
    #     return SchoolSerializer
    def get_serializer_class(self):
        if self.action == 'partial_update':
            return SchoolMiniSerializer  # ← Use Mini for PATCH response (has setup_complete)
        if self.action in ['create', 'update']:
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
        school = serializer.save(owner=self.request.user)
        school.users.add(self.request.user)
        return school
        
    # @action(detail=False, methods=['get'], url_path='active')
    # def active(self, request):
    #     """
    #     Get the first school the user is associated with.
    #     In future, you could add logic for user.active_school_id or priority.
    #     """
    #     # .first() is fine for now; consider ordering by created_at or is_active later
    #     school = School.objects.filter(users=request.user).first()
    #     if not school:
    #         return Response(
    #             {"detail": "No active school found for this user."},
    #             status=status.HTTP_404_NOT_FOUND
    #         )
    #     serializer = self.get_serializer(school)
    #     return Response(serializer.data)
    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        school = School.objects.filter(users=request.user).first()
        if not school:
            return Response({"detail": "No active school found."}, status=404)
    
    # Use Mini serializer for consistency (smaller payload + logo)
        serializer = SchoolMiniSerializer(school)
        return Response(serializer.data)
    # ── ADD THIS METHOD HERE ────────────────────────────────────────────────
    def update(self, request, *args, **kwargs):
        # Get the school instance
        instance = self.get_object()

        # Debug prints to see exactly why permission fails
        user = request.user
        owner = instance.owner

        print(f"DEBUG: PATCH User ID: {user.id} ({user.email})")
        print(f"DEBUG: School Owner ID: {owner.id if owner else 'None'}")
        print(f"DEBUG: User is staff? {user.is_staff}")
        print(f"DEBUG: Is owner == user? {owner == user}")

        # Permission check (keep strict for now, but we can relax later)
        if owner != user and not user.is_staff:
            raise PermissionDenied("You do not have permission to update this school.")

        # If you reach here → permission passed → proceed with normal update
        return super().update(request, *args, **kwargs)