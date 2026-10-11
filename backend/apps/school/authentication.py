from uuid import UUID

from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import School
from .support import active_support_session, audit_support_request


class SchoolContextJWTAuthentication(JWTAuthentication):
    """Validate the tenant header against membership or an active support session."""

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if authenticated is None:
            return None

        user, token = authenticated
        school_id = request.headers.get("X-School-ID")
        support_action = request.path.endswith(
            ("/schools/start-support-context/", "/schools/end-support-context/")
        )
        password_change = request.path.endswith("/accounts/change-password/")
        if (
            user.is_superuser
            and request.method not in ("GET", "HEAD", "OPTIONS")
            and not support_action
            and not password_change
        ):
            raise PermissionDenied("Platform administration is read-only.")
        if support_action:
            return authenticated

        if not school_id:
            return authenticated

        try:
            parsed_school_id = UUID(school_id)
        except (TypeError, ValueError):
            raise ValidationError({"school_id": "A valid school ID is required."})

        school = School.objects.filter(pk=parsed_school_id).first()
        if school is None:
            raise ValidationError({"school_id": "The selected school does not exist."})

        if user.is_superuser:
            session = active_support_session(user)
            support_session_id = request.headers.get("X-School-Support-ID")
            if (
                not session
                or session.school_id != school.id
                or support_session_id != str(session.id)
            ):
                raise PermissionDenied("Start an authorized school-support session first.")
            if (
                request.method not in ("GET", "HEAD", "OPTIONS")
                and not support_action
                and not password_change
            ):
                raise PermissionDenied("School-support access is read-only.")
            audit_support_request(request, session, user)
        elif not school.users.filter(pk=user.pk).exists() and school.owner_id != user.pk:
            raise PermissionDenied("You do not have access to this school.")

        return user, token
