"""Role-based library permissions with optional LibraryDelegate grants."""
from rest_framework.permissions import BasePermission, SAFE_METHODS

ADMIN_ROLES = {
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "DEPUTY_PRINCIPAL",
}
LIBRARIAN_ROLES = ADMIN_ROLES | {"LIBRARIAN"}
TEACHER_ROLES = LIBRARIAN_ROLES | {"TEACHER", "ACADEMIC_COORDINATOR"}


def _role(user) -> str:
    return (getattr(user, "role", None) or "").upper()


def is_admin(user) -> bool:
    return bool(user and user.is_authenticated and (
        getattr(user, "is_superuser", False) or _role(user) in ADMIN_ROLES
    ))


def is_librarian(user) -> bool:
    return bool(user and user.is_authenticated and (
        getattr(user, "is_superuser", False) or _role(user) in LIBRARIAN_ROLES
    ))


def is_teacher(user) -> bool:
    return bool(user and user.is_authenticated and (
        getattr(user, "is_superuser", False) or _role(user) in TEACHER_ROLES
    ))


def is_student(user) -> bool:
    return _role(user) == "STUDENT"


def is_parent(user) -> bool:
    return _role(user) == "PARENT"


def _delegate_flag(user, request, flag: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if is_librarian(user):
        return True
    try:
        from apps.core.tenancy import selected_school
        school = selected_school(request)
        if not school:
            return False
        from .models import LibraryDelegate
        d = LibraryDelegate.objects.filter(school=school, user=user).first()
        if not d:
            return False
        return bool(getattr(d, flag, False))
    except Exception:
        return False


class CanManageCatalogue(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated and not is_parent(request.user)
        return is_librarian(request.user) or _delegate_flag(request.user, request, "can_catalogue")


class CanIssueBooks(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return is_librarian(request.user) or _delegate_flag(request.user, request, "can_issue")


class CanManageAllocations(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated and not is_parent(request.user)
        return is_librarian(request.user) or _delegate_flag(request.user, request, "can_allocate")


class CanManageAcquisitions(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return is_librarian(request.user) or _delegate_flag(request.user, request, "can_acquire") or is_admin(request.user)
        return is_librarian(request.user) or _delegate_flag(request.user, request, "can_acquire")


class CanStocktake(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return is_librarian(request.user) or _delegate_flag(request.user, request, "can_stocktake") or is_admin(request.user)
        return is_librarian(request.user) or _delegate_flag(request.user, request, "can_stocktake")


class CanUploadDigital(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated and not is_parent(request.user)
        if is_librarian(request.user) or is_teacher(request.user):
            return True
        return _delegate_flag(request.user, request, "can_digital_upload")


class CanApproveDigital(BasePermission):
    def has_permission(self, request, view):
        return is_librarian(request.user) or _delegate_flag(request.user, request, "can_digital_approve")


class CanViewLibraryReports(BasePermission):
    def has_permission(self, request, view):
        return (
            is_librarian(request.user)
            or is_admin(request.user)
            or _delegate_flag(request.user, request, "can_reports")
        )


class IsNotParentAdminOnlyWrites(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_parent(request.user) and request.method not in SAFE_METHODS:
            return False
        return True


# Aliases expected by views (Phase 2/3 names)
class CanIssueReturn(CanIssueBooks):
    pass


class CanManageStocktake(CanStocktake):
    pass


class CanManageSettings(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated and not is_parent(request.user)
        return is_librarian(request.user) or is_admin(request.user)


def can_manage_physical(user) -> bool:
    return is_librarian(user) or is_admin(user)
