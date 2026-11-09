"""Preset term assessments and grading labels."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Q

from .models import Assessment

# Standard term structure for most CBC / 8-4-4 schools
DEFAULT_TERM_COLUMNS = [
    {"name": "CAT 1", "kind": Assessment.Kind.CAT, "weight": Decimal("1"), "max_score": Decimal("100")},
    {"name": "CAT 2", "kind": Assessment.Kind.CAT, "weight": Decimal("1"), "max_score": Decimal("100")},
    {"name": "CAT 3", "kind": Assessment.Kind.CAT, "weight": Decimal("1"), "max_score": Decimal("100")},
    {"name": "End of Term", "kind": Assessment.Kind.END_TERM, "weight": Decimal("2"), "max_score": Decimal("100")},
]

STANDARD_CORE_NAMES = frozenset({"CAT 1", "CAT 2", "CAT 3", "End of Term"})
STANDARD_OPTIONAL_NAMES = frozenset({"Practical"})

PRACTICAL_KEYWORDS = (
    "science",
    "biology",
    "chemistry",
    "physics",
    "agriculture",
    "home science",
    "computer",
    "ict",
    "integrated science",
    "lab",
)


def subject_needs_practical(subject) -> bool:
    name = (getattr(subject, "name", None) or "").lower()
    code = (getattr(subject, "code", None) or "").lower()
    blob = f"{name} {code}"
    return any(k in blob for k in PRACTICAL_KEYWORDS)


def preset_columns_for_subject(subject) -> list[dict]:
    cols = [dict(c) for c in DEFAULT_TERM_COLUMNS]
    if subject_needs_practical(subject):
        cols.append(
            {
                "name": "Practical",
                "kind": getattr(Assessment.Kind, "PRACTICAL", Assessment.Kind.PROJECT),
                "weight": Decimal("1"),
                "max_score": Decimal("100"),
            }
        )
    return cols


def assessment_names_look_standard(names) -> bool:
    """True when the set of assessment names matches the school standard plan."""
    nset = {str(n).strip() for n in names if n}
    if not nset:
        return False
    # Core CATs + End of Term present; Practical optional; no foreign columns
    if STANDARD_CORE_NAMES.issubset(nset):
        extras = nset - STANDARD_CORE_NAMES - STANDARD_OPTIONAL_NAMES
        return len(extras) == 0
    return False


def grade_uses_standard_plan(*, school, academic_year, term, grade_level) -> bool:
    """
    True if any subject in this grade/year/term already uses the standard column set.
    Custom-only plans on other subjects must NOT trigger auto-standard for new subjects.
    """
    qs = Assessment.objects.filter(
        school=school,
        academic_year=academic_year,
        grade_level=grade_level,
    ).filter(Q(term=term) | Q(term__isnull=True))

    by_subject: dict = {}
    for sid, name in qs.values_list("subject_id", "name"):
        by_subject.setdefault(sid, set()).add(name)
    return any(assessment_names_look_standard(names) for names in by_subject.values())


@transaction.atomic
def ensure_term_assessments(
    *,
    school,
    academic_year,
    term,
    grade_level,
    subject,
    created_by=None,
):
    """
    Ensure preset CAT/End-term/(Practical) rows exist for this class-subject-term.
    Returns ordered list of Assessment instances (created or existing).

    If this subject already has a *custom* plan, leave it untouched (do not mix
    standard columns on top). Standard columns are only created for empty plans
    or existing standard plans.
    """
    existing_qs = Assessment.objects.filter(
        school=school,
        academic_year=academic_year,
        term=term,
        grade_level=grade_level,
        subject=subject,
    )
    existing_names = set(existing_qs.values_list("name", flat=True))
    if existing_names and not assessment_names_look_standard(existing_names):
        return list(existing_qs.order_by("assessment_date", "created_at", "name"))

    columns = preset_columns_for_subject(subject)
    result = []
    for col in columns:
        obj, _created = Assessment.objects.get_or_create(
            school=school,
            academic_year=academic_year,
            term=term,
            grade_level=grade_level,
            subject=subject,
            name=col["name"],
            defaults={
                "kind": col["kind"],
                "weight": col["weight"],
                "max_score": col["max_score"],
                "section": None,
                "created_by": created_by,
            },
        )
        dirty = False
        if obj.kind != col["kind"]:
            obj.kind = col["kind"]
            dirty = True
        if obj.weight != col["weight"]:
            obj.weight = col["weight"]
            dirty = True
        if dirty:
            obj.save(update_fields=["kind", "weight", "updated_at"])
        result.append(obj)
    order = {c["name"]: i for i, c in enumerate(columns)}
    result.sort(key=lambda a: order.get(a.name, 99))
    return result
