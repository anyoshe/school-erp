# from django.shortcuts import render

# Create your views here.

from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import User, Permission, UserPermission
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    PermissionSerializer,
    UserPermissionSerializer,
)

class UserViewSet(ModelViewSet):
    """
    API endpoints for managing users.
    """
    queryset = User.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

class PermissionViewSet(ModelViewSet):
    """
    Manage system permissions.
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]

class UserPermissionViewSet(ModelViewSet):
    """
    Assign permissions to users.
    """
    queryset = UserPermission.objects.select_related('user', 'permission')
    serializer_class = UserPermissionSerializer
    permission_classes = [IsAuthenticated]
