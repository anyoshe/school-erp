# accounts/permissions.py
from rest_framework.permissions import BasePermission
from django.contrib.auth import get_user_model

User = get_user_model()


class IsSuperAdmin(BasePermission):
    """
    Allows access only to super admins
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.SUPER_ADMIN


class IsSchoolAdminOrHigher(BasePermission):
    """
    Allows access to:
    - SUPER_ADMIN
    - SCHOOL_ADMIN
    - PRINCIPAL
    - DEPUTY_PRINCIPAL
    """
    allowed_roles = {
        User.Role.SUPER_ADMIN,
        User.Role.SCHOOL_ADMIN,
        User.Role.PRINCIPAL,
        User.Role.DEPUTY_PRINCIPAL,
    }

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in self.allowed_roles
        )