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
    PermissionSerializer,
    UserPermissionSerializer,
    CurrentUserSerializer,
)
from .permissions import IsSchoolAdminOrHigher, IsSuperAdmin  # ← add this if you create it

User = get_user_model()

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsSchoolAdminOrHigher]  # or stricter

    # Optional: only allow owners/admins to modify roles
    def perform_update(self, serializer):
        # You can add extra checks here if needed
        super().perform_update(serializer)

class CurrentUserView(APIView):
    """
    Returns the currently authenticated user's data
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = User.objects.prefetch_related('schools__modules').get(pk=request.user.pk)
        serializer = CurrentUserSerializer(user)
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
        # Adjust this based on your actual relationship
        # If User has ManyToManyField to School named 'schools':
        return User.objects.filter(schools=school)
        # If using through model (SchoolUserRole):
        # return User.objects.filter(school_roles__school=school)

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
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

        # Link user to this school
        # If ManyToMany:
        school.users.add(user)
        # If through model (SchoolUserRole):
        # SchoolUserRole.objects.create(
        #     user=user,
        #     school=school,
        #     role=request.data.get('role')
        # )
        print("DEBUG: After save, does user have _temporary_password?", hasattr(user, '_temporary_password'))
        # Re-serialize with same context to preserve temporary_password
        # response_serializer = self.get_serializer(user, context=serializer.context)
        # return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
        response_serializer = self.get_serializer(user, context=serializer.context)
        response_data = response_serializer.data

        temp_pass = getattr(user, '_temporary_password', None)
        print("DEBUG: Temp pass before adding to response:", temp_pass)

        if temp_pass:
           response_data['temporary_password'] = temp_pass
        print("DEBUG: Added temporary_password to response_data")

        return Response(response_data, status=201)