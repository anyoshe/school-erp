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
        school = getattr(obj, "school", None)
        if school is None and hasattr(obj, "category"):
            school = getattr(obj.category, "school", None)
        if school is None and hasattr(obj, "student"):
            school = getattr(obj.student, "school", None)
        if school is None and hasattr(obj, "invoice"):
            school = getattr(obj.invoice, "school", None)
        if school is None and hasattr(obj, "application"):
            school = getattr(obj.application, "school", None)
        if school is None and hasattr(obj, "users"):
            school = obj

        if school is None:
            return False

        if request.user.is_superuser:
            from apps.school.support import active_support_session

            support_session = active_support_session(request.user)
            return bool(
                request.method in permissions.SAFE_METHODS
                and support_session
                and support_session.school_id == school.pk
                and request.headers.get("X-School-ID") == str(school.pk)
                and request.headers.get("X-School-Support-ID") == str(support_session.pk)
            )

        from apps.school.support import accessible_school_ids

        return accessible_school_ids(request).filter(pk=school.pk).exists()
    
# from rest_framework import permissions

# class IsAssociatedWithSchool(permissions.BasePermission):
#     """
#     Allows actions only if the requesting user is associated with the school.

#     - Safe methods (GET) → require authentication
#     - Write methods → verify user belongs to the related school
#     """

#     message = "You do not have permission to perform this action for this school."

#     def has_permission(self, request, view):
#         if request.method in permissions.SAFE_METHODS:
#             return request.user.is_authenticated
#         return request.user.is_authenticated

#     def has_object_permission(self, request, view, obj):

#         school = None

#         # Case 1: object has school directly
#         if hasattr(obj, "school"):
#             school = obj.school

#         # Case 2: FeeItem → category → school
#         elif hasattr(obj, "category") and hasattr(obj.category, "school"):
#             school = obj.category.school

#         # Case 3: Student → school
#         elif hasattr(obj, "student") and hasattr(obj.student, "school"):
#             school = obj.student.school

#         # Case 4: Invoice → student → school
#         elif hasattr(obj, "invoice") and hasattr(obj.invoice, "student"):
#             school = obj.invoice.student.school

#         if school is None:
#             return False

#         # return request.user in school.users.all()
#         return school.users.filter(id=request.user.id).exists()