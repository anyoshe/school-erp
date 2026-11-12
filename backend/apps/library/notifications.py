"""Library notifications via parent_portal.Notification + idempotent log."""
from datetime import date, timedelta
from django.db import transaction
from django.utils import timezone


def _portal_notify(school, user, title: str, message: str):
    if not user or not school:
        return None
    try:
        from apps.parent_portal.models import Notification
    except Exception:
        return None
    return Notification.objects.create(
        school=school, user=user, title=title[:150], message=message
    )


def notify_once(school, user, event_key: str, title: str, message: str):
    """Send notification at most once per (school, user, event_key)."""
    if not user or not school:
        return None
    from .models import LibraryNotificationLog
    if LibraryNotificationLog.objects.filter(
        school=school, user=user, event_key=event_key
    ).exists():
        return None
    with transaction.atomic():
        LibraryNotificationLog.objects.create(
            school=school, user=user, event_key=event_key[:200]
        )
        return _portal_notify(school, user, title, message)


def notify_loan_issued(loan):
    user = loan.user
    if not user:
        return
    title = loan.book.title if loan.book_id else "Book"
    notify_once(
        loan.school,
        user,
        f"issue:{loan.id}",
        "Library book issued",
        f"You borrowed: {title}. Due: {loan.due_date or 'see library'}.",
    )


def notify_loan_returned(loan):
    user = loan.user
    if not user:
        return
    title = loan.book.title if loan.book_id else "Book"
    notify_once(
        loan.school,
        user,
        f"return:{loan.id}",
        "Library book returned",
        f"Return recorded for: {title}.",
    )


def process_due_and_overdue(school=None, due_soon_days: int = 2):
    """Idempotent batch for due-soon and overdue loans. Safe for cron."""
    from .models import Borrowing
    from apps.school.models import School

    schools = [school] if school else School.objects.all()
    today = date.today()
    soon = today + timedelta(days=due_soon_days)
    stats = {"due_soon": 0, "overdue": 0, "reservations": 0, "assignments": 0}

    for sch in schools:
        active = Borrowing.objects.filter(
            school=sch, status__in=["ACTIVE", "OVERDUE"]
        ).select_related("user", "book")
        for loan in active:
            if not loan.user_id or not loan.due_date:
                continue
            if loan.due_date < today:
                if loan.status != "OVERDUE":
                    Borrowing.objects.filter(pk=loan.pk).update(status="OVERDUE")
                if notify_once(
                    sch,
                    loan.user,
                    f"overdue:{loan.id}:{loan.due_date.isoformat()}",
                    "Library book overdue",
                    f"Overdue: {loan.book.title if loan.book_id else 'book'} (due {loan.due_date}). Please return.",
                ):
                    stats["overdue"] += 1
            elif loan.due_date <= soon:
                if notify_once(
                    sch,
                    loan.user,
                    f"due_soon:{loan.id}:{loan.due_date.isoformat()}",
                    "Library book due soon",
                    f"Due soon: {loan.book.title if loan.book_id else 'book'} on {loan.due_date}.",
                ):
                    stats["due_soon"] += 1

        # Reservations ready
        from .models import Reservation, BookCopy
        ready = Reservation.objects.filter(school=sch, status="READY")
        for r in ready:
            if not r.user_id:
                continue
            if notify_once(
                sch,
                r.user,
                f"reservation_ready:{r.id}",
                "Reserved book available",
                f"Your reservation is ready: {r.book.title if r.book_id else 'book'}.",
            ):
                stats["reservations"] += 1

        # Assignment deadlines
        from .models import ResourceAssignment
        from apps.students.models import Student
        assigns = ResourceAssignment.objects.filter(school=sch).exclude(due_date=None)
        for a in assigns:
            if not a.due_date:
                continue
            users = []
            if a.student_id:
                # try student.user if exists
                st = a.student
                u = getattr(st, "user", None)
                if u:
                    users.append(u)
            for u in users:
                if a.due_date < today:
                    key = f"assign_overdue:{a.id}"
                    title, msg = "Reading assignment overdue", f"Assignment overdue (due {a.due_date})."
                elif a.due_date <= soon:
                    key = f"assign_due:{a.id}:{a.due_date.isoformat()}"
                    title, msg = "Reading assignment due soon", f"Assignment due {a.due_date}."
                else:
                    continue
                if notify_once(sch, u, key, title, msg):
                    stats["assignments"] += 1

    return stats
