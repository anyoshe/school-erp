from rest_framework import viewsets
from .models import Role
from .serializers import RoleSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework.decorators import action
from rest_framework import status
from django.contrib.auth import update_session_auth_hash
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from apps.school.models import School  # adjust import path if needed
from apps.school.support import accessible_school_ids

from .models import User, Permission, UserPermission
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    UserUpdateSerializer,
    PermissionSerializer,
    UserPermissionSerializer,
    CurrentUserSerializer,
)
from .permissions import IsSchoolAdminOrHigher, IsSuperAdmin  # ← add this if you create it

User = get_user_model()

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().prefetch_related("modules").order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsSchoolAdminOrHigher]
    lookup_field = "pk"
    pagination_class = None  # always return a plain list for the settings UI

    def get_queryset(self):
        return Role.objects.all().prefetch_related("modules").order_by("name")

class CurrentUserView(APIView):
    """
    Returns the currently authenticated user's data
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = User.objects.prefetch_related('schools__modules', 'roles__modules', 'extra_modules').get(pk=request.user.pk)
        # Parents invited before membership fix: attach school from guardian links
        if (getattr(user, "role", "") or "").upper() == "PARENT":
            try:
                from apps.parent_portal.models import GuardianProfile, ParentStudentLink
                from apps.school.models import School
                school_ids = set()
                for sid in GuardianProfile.objects.filter(user=user).values_list("school_id", flat=True):
                    if sid:
                        school_ids.add(sid)
                for sid in ParentStudentLink.objects.filter(
                    guardian_profile__user=user
                ).values_list("school_id", flat=True):
                    if sid:
                        school_ids.add(sid)
                for sid in school_ids:
                    school = School.objects.filter(pk=sid).first()
                    if school is not None:
                        school.users.add(user)
                user = User.objects.prefetch_related("schools__modules").get(pk=user.pk)
            except Exception:
                pass
        serializer = CurrentUserSerializer(user, context={"request": request})
        return Response(serializer.data)
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-created_at')

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated(), IsSchoolAdminOrHigher()]

    def get_authentication_classes(self):
        """Completely disable authentication for user creation (signup)"""
        if self.action == 'create':
            return []                     # ← This is the missing piece
        return super().get_authentication_classes()  # or explicitly return [JWTAuthentication]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_queryset(self):
        return User.objects.filter(
            schools__id__in=accessible_school_ids(self.request)
        ).distinct()
    
    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        user = User.objects.get(id=response.data['id'])
        return Response({
            **response.data,
            'temporary_password': getattr(user, '_temporary_password', None)
        })

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """Alternative endpoint to get current user data"""
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)

    # ← Add this: protect user deletion
    def destroy(self, request, *args, **kwargs):
        """
        Only SUPER_ADMIN and SCHOOL_ADMIN can delete users
        """
        if request.user.role not in {User.Role.SUPER_ADMIN, User.Role.SCHOOL_ADMIN}:
            return Response(
                {"detail": "Only Super Admin or School Admin can delete users."},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class PermissionViewSet(viewsets.ModelViewSet):
    """
    System permissions — usually only SUPER_ADMIN should manage
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]  # ← stricter


class UserPermissionViewSet(viewsets.ModelViewSet):
    """
    Assign/remove specific permissions to users
    """
    queryset = UserPermission.objects.select_related('user', 'permission')
    serializer_class = UserPermissionSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin] 

    def get_queryset(self):
        return UserPermission.objects.filter(
            user__schools__id__in=accessible_school_ids(self.request)
        ).distinct()
    
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        # If user has force_change_password flag, skip old password check
        if not user.force_change_password:
            if not old_password or not user.check_password(old_password):
                return Response({"detail": "Current password is incorrect"}, status=400)

        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        user.force_change_password = False  # ← Clear the flag after password change
        user.save()
        update_session_auth_hash(request, user)  # keep session alive

        return Response({"detail": "Password updated successfully"})
    
class SchoolUserViewSet(viewsets.ModelViewSet):
    """
    Endpoint: /api/schools/{school_id}/users/
    Create / list users for a specific school
    """
    permission_classes = [IsAuthenticated, IsSchoolAdminOrHigher]
    serializer_class = UserSerializer

    def get_queryset(self):
        school_id = self.kwargs['school_id']
        school = get_object_or_404(
            School,
            id=school_id,
            pk__in=accessible_school_ids(self.request),
        )
        return User.objects.filter(schools=school)

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        school_id = self.kwargs['school_id']
        school = get_object_or_404(
            School,
            id=school_id,
            pk__in=accessible_school_ids(request),
        )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        # Multi-role from request (create serializer also handles; belt-and-braces)
        from apps.accounts.serializers import apply_user_roles_and_modules
        apply_user_roles_and_modules(
            user,
            role_codes=request.data.get("role_codes") or request.data.get("roles"),
            extra_module_ids=request.data.get("extra_module_ids"),
            primary_role=request.data.get("role"),
        )

        school.users.add(user)

        response_serializer = self.get_serializer(user, context=serializer.context)
        response_data = response_serializer.data

        temp_pass = getattr(user, '_temporary_password', None)

        if temp_pass:
           response_data['temporary_password'] = temp_pass

        return Response(response_data, status=201)