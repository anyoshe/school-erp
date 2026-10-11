from rest_framework.permissions import BasePermission


class IsPlatformSuperuser(BasePermission):
    message = "Only a Django superuser can administer platform schools."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
