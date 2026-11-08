"""Preset term assessments and grading labels."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from .grading import grade_label
from .models import Assessment

# Standard term structure for most CBC / 8-4-4 schools
DEFAULT_TERM_COLUMNS = [
    {"name": "CAT 1", "kind": Assessment.Kind.CAT, "weight": Decimal("1"), "max_score": Decimal("100")},
    {"name": "CAT 2", "kind": Assessment.Kind.CAT, "weight": Decimal("1"), "max_score": Decimal("100")},
    {"name": "CAT 3", "kind": Assessment.Kind.CAT, "weight": Decimal("1"), "max_score": Decimal("100")},
    {"name": "End of Term", "kind": Assessment.Kind.END_TERM, "weight": Decimal("2"), "max_score": Decimal("100")},
]

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
    """
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
        # Keep weight/kind in sync if previously created with defaults
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
    # Stable order matching presets
    order = {c["name"]: i for i, c in enumerate(columns)}
    result.sort(key=lambda a: order.get(a.name, 99))
    return result
