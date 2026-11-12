"""Library RBAC mapped to existing User.Role values."""
from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.school.support import accessible_school_ids, selected_school


ADMIN_ROLES = {
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "DEPUTY_PRINCIPAL",
}

LIBRARIAN_ROLES = ADMIN_ROLES | {"LIBRARIAN"}

STAFF_MANAGE_ROLES = LIBRARIAN_ROLES | {
    "ACADEMIC_COORDINATOR",
    "ADMISSIONS_OFFICER",
    "ACCOUNTANT",
}

TEACHER_ROLES = STAFF_MANAGE_ROLES | {"TEACHER"}

STUDENT_ROLES = {"STUDENT"}
PARENT_ROLES = {"PARENT"}


def user_role(user) -> str:
    return (getattr(user, "role", None) or "").upper()


def is_library_admin(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    return user_role(user) in ADMIN_ROLES


def is_librarian(user) -> bool:
    if is_library_admin(user):
        return True
    return user_role(user) in {"LIBRARIAN"}


def is_teacher(user) -> bool:
    if is_librarian(user):
        return True
    return user_role(user) in {"TEACHER", "ACADEMIC_COORDINATOR"}


def is_student(user) -> bool:
    return user_role(user) == "STUDENT"


def can_manage_physical(user) -> bool:
    return is_librarian(user) or user_role(user) in ADMIN_ROLES


def can_approve_digital(user) -> bool:
    return is_librarian(user) or is_library_admin(user)


def can_issue_return(user) -> bool:
    return is_librarian(user) or is_library_admin(user)


def school_in_scope(request, school_id) -> bool:
    if school_id is None:
        return False
    return accessible_school_ids(request).filter(pk=school_id).exists()


class IsLibraryAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class CanManageCatalogue(BasePermission):
    """Create/update books, copies, acquisitions."""

    message = "Only librarians or school administrators can manage the catalogue."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return can_manage_physical(request.user)


class CanIssueReturn(BasePermission):
    message = "Only librarians or administrators can issue or return books."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            # Students may read own loans — view filters
            return True
        action = getattr(view, "action", None)
        if action in ("issue", "return_loan", "create", "update", "partial_update", "destroy"):
            return can_issue_return(request.user)
        return can_manage_physical(request.user)


class CanApproveDigital(BasePermission):
    message = "Only librarians or administrators can approve digital resources."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        action = getattr(view, "action", None)
        if action in ("approve", "reject"):
            return can_approve_digital(request.user)
        if request.method in SAFE_METHODS:
            return True
        # upload: teachers + librarians + admin
        if request.method in ("POST", "PUT", "PATCH"):
            return is_teacher(request.user) or is_librarian(request.user)
        if request.method == "DELETE":
            return can_approve_digital(request.user)
        return False


class CanManageStocktake(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return is_teacher(request.user) or is_librarian(request.user)
        return can_manage_physical(request.user)


class CanManageAllocations(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return is_teacher(request.user) or is_librarian(request.user)
        return can_manage_physical(request.user) or is_teacher(request.user)


class CanManageSettings(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return is_teacher(request.user) or is_librarian(request.user)
        return is_library_admin(request.user) or is_librarian(request.user)
