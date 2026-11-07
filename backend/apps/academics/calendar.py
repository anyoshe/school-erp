"""
Academic calendar as system source of truth for year + term labels.
Used by finance, school pulse, enrollment defaults.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Optional, Tuple


def get_school_calendar(school) -> dict[str, Any]:
    """
    Returns:
      {
        "academic_year": AcademicYear|None,
        "year_label": str,
        "term": Term|None,
        "term_label": str,
        "terms": list[Term],
      }
    """
    from apps.academics.models import AcademicYear, Term

    if school is None:
        return {
            "academic_year": None,
            "year_label": str(date.today().year),
            "term": None,
            "term_label": "Term 1",
            "terms": [],
        }

    year = (
        AcademicYear.objects.filter(school=school, is_active=True)
        .prefetch_related("terms")
        .first()
    )
    if not year:
        year = (
            AcademicYear.objects.filter(school=school)
            .prefetch_related("terms")
            .order_by("-start_date")
            .first()
        )

    terms = list(year.terms.all()) if year else []
    term = None
    if terms:
        term = next((t for t in terms if getattr(t, "is_current", False)), None)
        if not term:
            today = date.today()
            for t in terms:
                if t.start_date and t.end_date and t.start_date <= today <= t.end_date:
                    term = t
                    break
        if not term:
            term = terms[0]

    return {
        "academic_year": year,
        "year_label": (year.name if year else str(date.today().year)) or str(date.today().year),
        "term": term,
        "term_label": (term.name if term else "Term 1") or "Term 1",
        "terms": terms,
    }


def detect_year_term_labels(school) -> Tuple[str, str]:
    cal = get_school_calendar(school)
    return cal["year_label"], cal["term_label"]


def set_current_term(term) -> None:
    """Mark term current; clear other terms for the same school."""
    from apps.academics.models import Term
    year = term.academic_year
    school_id = year.school_id
    Term.objects.filter(academic_year__school_id=school_id).exclude(pk=term.pk).update(is_current=False)
    if not term.is_current:
        term.is_current = True
        term.save(update_fields=["is_current"])
    # Ensure year is active
    from apps.academics.models import AcademicYear
    AcademicYear.objects.filter(school_id=school_id, is_active=True).exclude(pk=year.pk).update(is_active=False)
    if not year.is_active:
        year.is_active = True
        year.save(update_fields=["is_active"])


def ensure_default_terms(year) -> list:
    """Create Term 1–3 with equal date slices if year has no terms."""
    from apps.academics.models import Term
    from datetime import timedelta

    existing = list(year.terms.all())
    if existing:
        return existing
    start = year.start_date
    end = year.end_date
    if not start or not end or end <= start:
        return []
    total_days = (end - start).days
    # 3 terms roughly equal
    span = max(total_days // 3, 1)
    created = []
    cursor = start
    for i, name in enumerate(["Term 1", "Term 2", "Term 3"], start=1):
        if i < 3:
            t_end = cursor + timedelta(days=span - 1)
        else:
            t_end = end
        if t_end > end:
            t_end = end
        t = Term.objects.create(
            academic_year=year,
            name=name,
            start_date=cursor,
            end_date=t_end,
            order=i,
            is_current=(i == 1),
        )
        created.append(t)
        cursor = t_end + timedelta(days=1)
        if cursor > end:
            break
    return created
