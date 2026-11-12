"""Library notifications using parent_portal.Notification when available."""
from django.db import transaction


def notify(school, user, title: str, message: str):
    if not user or not school:
        return None
    try:
        from apps.parent_portal.models import Notification
    except Exception:
        return None
    # de-dupe same title+user unread within 24h-ish: skip exact open duplicate
    existing = Notification.objects.filter(
        school=school, user=user, title=title, is_read=False, message=message
    ).exists()
    if existing:
        return None
    return Notification.objects.create(
        school=school, user=user, title=title[:150], message=message
    )


@transaction.atomic
def notify_loan_issued(loan):
    user = loan.user
    if not user and loan.student_id:
        # no user link on student model typically
        return
    if user:
        notify(
            loan.school,
            user,
            "Library book issued",
            f"You borrowed: {loan.book.title}. Due: {loan.due_date or 'see library'}.",
        )


@transaction.atomic
def notify_assignment(assignment):
    # notify student user if linked — skip if no user
    pass
