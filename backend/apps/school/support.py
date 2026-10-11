from django.utils import timezone
from django.db.models import Q

from uuid import UUID

from .models import School, SchoolSupportAuditLog, SchoolSupportSession


def active_support_session(user):
    if not getattr(user, "is_superuser", False):
        return None
    return (
        SchoolSupportSession.objects.filter(
            administrator=user,
            ended_at__isnull=True,
        )
        .select_related("school")
        .first()
    )


def accessible_school_ids(request):
    """Return only tenant IDs authorized for this request's user and context."""
    user = request.user
    if not getattr(user, "is_authenticated", False):
        return School.objects.none().values_list("id", flat=True)

    selected_id = request.headers.get("X-School-ID")
    if getattr(user, "is_superuser", False):
        session = active_support_session(user)
        if session is None or not selected_id:
            return School.objects.none().values_list("id", flat=True)
        if str(session.school_id) != selected_id:
            return School.objects.none().values_list("id", flat=True)
        return School.objects.filter(pk=session.school_id).values_list("id", flat=True)

    schools = School.objects.filter(Q(users=user) | Q(owner=user)).distinct()
    if selected_id:
        schools = schools.filter(pk=selected_id)
    return schools.values_list("id", flat=True)


def selected_school(request):
    school_id = request.headers.get("X-School-ID")
    if not school_id:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Select a school before creating school data.")
    school = School.objects.filter(pk__in=accessible_school_ids(request)).first()
    if school is None:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("The selected school is not available in this context.")
    return school


def close_support_sessions(user, action="context_ended"):
    sessions = SchoolSupportSession.objects.filter(
        administrator=user,
        ended_at__isnull=True,
    )
    now = timezone.now()
    for session in sessions:
        session.ended_at = now
        session.save(update_fields=["ended_at"])
        SchoolSupportAuditLog.objects.create(
            administrator=user,
            school=session.school,
            support_session=session,
            action=action,
        )


def audit_support_request(request, session, administrator):
    parts = [part for part in request.path.split("/") if part]
    record_id = ""
    record_type = parts[-1] if parts else ""
    if parts:
        try:
            UUID(parts[-1])
            record_id = parts[-1]
            record_type = parts[-2] if len(parts) > 1 else ""
        except ValueError:
            pass

    SchoolSupportAuditLog.objects.create(
        administrator=administrator,
        school=session.school,
        support_session=session,
        action=f"{request.method.lower()}:{record_type}",
        record_type=record_type[:100],
        record_id=record_id,
    )
