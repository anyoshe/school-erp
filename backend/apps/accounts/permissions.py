# accounts/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.contrib.auth import get_user_model

User = get_user_model()


class IsSuperAdmin(BasePermission):
    """Allows access only to superusers."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsSchoolAdminOrHigher(BasePermission):
    """
    School leadership / admin roles (primary or multi-role).
    """

    allowed_roles = {
        "SUPER_ADMIN",
        "SCHOOL_ADMIN",
        "PRINCIPAL",
        "DEPUTY_PRINCIPAL",
        "MANAGER",
    }

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_superuser", False):
            return True
        codes = set()
        primary = (getattr(user, "role", None) or "").strip().upper()
        if primary:
            codes.add(primary)
        try:
            codes |= {c.upper() for c in user.get_role_codes()}
        except Exception:
            pass
        return bool(codes & self.allowed_roles)
