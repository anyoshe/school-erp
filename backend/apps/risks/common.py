"""Shared helpers for risk scanners."""
from __future__ import annotations

from typing import Iterable

from django.utils import timezone


def student_name(student) -> str:
    name = getattr(student, "full_name", None)
    if name:
        return str(name).strip()
    return (
        f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        or "Student"
    )


def upsert_alert(
    *,
    school,
    fingerprint: str,
    category: str,
    severity: str,
    title: str,
    detail: str,
    metrics: dict,
    student=None,
    action_path: str = "",
):
    from apps.risks.models import RiskAlert

    obj, created = RiskAlert.objects.update_or_create(
        school=school,
        fingerprint=fingerprint,
        defaults={
            "category": category,
            "severity": severity,
            "status": RiskAlert.Status.OPEN,
            "title": title[:200],
            "detail": detail,
            "metrics": metrics or {},
            "student": student,
            "action_path": (action_path or "")[:255],
            "resolved_at": None,
        },
    )
    return obj, created


def close_stale(school, keep_fingerprints: Iterable[str], category: str):
    from apps.risks.models import RiskAlert

    qs = RiskAlert.objects.filter(
        school=school,
        category=category,
        status=RiskAlert.Status.OPEN,
    ).exclude(fingerprint__in=list(keep_fingerprints))
    return qs.update(status=RiskAlert.Status.RESOLVED, resolved_at=timezone.now())
