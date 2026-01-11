# core/permissions.py
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

class IsAssociatedWithSchool(permissions.BasePermission):
    """
    Allows actions only if the requesting user is associated with the school
    (via the ManyToManyField 'users' on School model).
    
    - For safe methods (GET) → allow if authenticated
    - For write methods → check user in school.users.all()
    """
    message = "You do not have permission to perform this action for this school."

    def has_permission(self, request, view):
        # Safe methods (list, retrieve) only require authentication
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return True  # write permissions checked in has_object_permission

    def has_object_permission(self, request, view, obj):
        # obj can be School, FeeCategory, FeeItem, Curriculum, etc.
        # Get the related school object
        school = getattr(obj, 'school', obj)  # if obj is FeeCategory → obj.school

        # If somehow no school relation → deny
        if not hasattr(school, 'users'):
            return False

        return request.user in school.users.all()