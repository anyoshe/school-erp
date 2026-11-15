"""
Canonical optional fee items for clearance / returning bills.

Keeps Meals, Books, Assessment books, Uniforms, Transport, and Miscellaneous
stable so cashiers select existing items instead of inventing new names.
"""
from __future__ import annotations

from django.db.models import Q


# code -> (category_name, item_name, keywords for matching free text / legacy lines)
CANONICAL_OPTIONALS = (
    {
        "code": "meals",
        "category": "Meals & catering",
        "item": "Lunch / meals",
        "keywords": ("meal", "lunch", "catering", "feeding", "kitchen", "canteen"),
        "description": "School lunch / meals program",
        "display_order": 55,
    },
    {
        "code": "books",
        "category": "Books & learning materials",
        "item": "Textbooks / books",
        "keywords": ("textbook", "text book", "books", "course book", "workbook"),
        "description": "Textbooks and learning materials",
        "display_order": 60,
    },
    {
        "code": "assessment_books",
        "category": "Books & learning materials",
        "item": "Assessment books",
        "keywords": ("assessment book", "assessment books", "assesment", "exam book"),
        "description": "Assessment / exam books",
        "display_order": 61,
    },
    {
        "code": "uniforms",
        "category": "Uniforms & kit",
        "item": "School uniform",
        "keywords": ("uniform", "sports wear", "pe kit", "sweater", "tracksuit"),
        "description": "School uniform and kit",
        "display_order": 65,
    },
    {
        "code": "transport",
        "category": "Transport",
        "item": "School transport",
        "keywords": ("transport", "bus", "van", "boarding van", "school bus"),
        "description": "School transport / bus",
        "display_order": 70,
    },
    {
        "code": "misc",
        "category": "Miscellaneous",
        "item": "Miscellaneous charges",
        "keywords": ("misc", "miscellaneous", "sundry", "other fee"),
        "description": "General miscellaneous charges",
        "display_order": 90,
    },
)

OTHER_CATEGORY = "Other charges"


def _text_match(text: str, keywords: tuple) -> bool:
    s = (text or "").strip().lower()
    if not s:
        return False
    # Prefer longer keywords first so "assessment book" wins over "book"
    for k in sorted(keywords, key=len, reverse=True):
        if k in s:
            return True
    return False


def match_catalog_entry(text: str):
    """Return best CANONICAL_OPTIONALS entry for free text, or None."""
    s = (text or "").strip().lower()
    if not s:
        return None
    # assessment before general books
    ordered = sorted(
        CANONICAL_OPTIONALS,
        key=lambda e: (0 if e["code"] == "assessment_books" else 1, -max(len(k) for k in e["keywords"])),
    )
    for entry in ordered:
        if _text_match(s, entry["keywords"]):
            return entry
    return None


def ensure_optional_fee_catalog(school) -> list:
    """
    Ensure canonical categories + items exist. Returns list of dicts for API/UI.
    """
    from apps.finance.models import FeeCategory, FeeItem
    from apps.finance.lunch import ensure_meals_fee_defaults

    # Keep meals consolidation behaviour from lunch module
    try:
        ensure_meals_fee_defaults(school)
    except Exception:
        pass

    out = []
    for entry in CANONICAL_OPTIONALS:
        cat, _ = FeeCategory.objects.get_or_create(
            school=school,
            name=entry["category"],
            defaults={
                "description": entry["category"],
                "is_mandatory": False,
                "display_order": entry["display_order"],
            },
        )
        if cat.is_mandatory:
            cat.is_mandatory = False
            cat.save(update_fields=["is_mandatory"])

        item, created = FeeItem.objects.get_or_create(
            category=cat,
            name=entry["item"],
            defaults={
                "description": entry["description"],
                "frequency": "per_term",
                "is_active": True,
                "is_optional": True,
            },
        )
        dirty = False
        if not item.is_active:
            item.is_active = True
            dirty = True
        if not item.is_optional:
            item.is_optional = True
            dirty = True
        if dirty:
            item.save(update_fields=["is_active", "is_optional"])

        out.append(
            {
                "code": entry["code"],
                "fee_item_id": str(item.id),
                "name": item.name,
                "category": cat.name,
                "category_id": str(cat.id),
                "is_optional": True,
                "keywords": list(entry["keywords"]),
            }
        )
    return out


def resolve_fee_item_for_extra(school, *, fee_item_id=None, description: str = ""):
    """
    Resolve which FeeItem to use for a clearance/returning extra line.

    Priority:
    1. Explicit fee_item_id (must belong to school)
    2. Keyword match → canonical catalog item
    3. None → caller may create under Other charges
    """
    from apps.finance.models import FeeItem

    ensure_optional_fee_catalog(school)

    if fee_item_id:
        item = FeeItem.objects.filter(
            pk=fee_item_id, category__school=school, is_active=True
        ).select_related("category").first()
        if item:
            # If they picked a random item but text is meals, still ok — trust id
            return item, "selected"

    entry = match_catalog_entry(description)
    if entry:
        item = FeeItem.objects.filter(
            category__school=school,
            category__name=entry["category"],
            name=entry["item"],
        ).first()
        if item:
            return item, entry["code"]

    return None, None


def rehome_stray_optional_invoice_lines(school) -> dict:
    """
    Re-point invoice lines that match catalog keywords but use non-canonical
    items (e.g. Additional charges / Assessment book free-text) onto catalog items.
    """
    from apps.finance.models import InvoiceLine, FeeItem

    catalog = ensure_optional_fee_catalog(school)
    by_code = {c["code"]: c for c in catalog}
    # Build item id set that is already canonical
    canonical_ids = {c["fee_item_id"] for c in catalog}

    moved = {c["code"]: 0 for c in catalog}
    qs = InvoiceLine.objects.filter(invoice__school=school).select_related(
        "item", "item__category"
    )
    # Avoid .iterator() — Neon pooler drops server-side cursors
    for line in qs:
        text = f"{line.description or ''} {getattr(line.item, 'name', '') or ''}"
        entry = match_catalog_entry(text)
        if not entry:
            continue
        target_id = by_code[entry["code"]]["fee_item_id"]
        current_id = str(line.item_id) if line.item_id else ""
        if current_id == target_id:
            continue
        # Don't move unrelated lines that barely matched misc
        if entry["code"] == "misc" and not _text_match(
            text, ("misc", "miscellaneous", "sundry")
        ):
            continue
        target = FeeItem.objects.filter(pk=target_id).first()
        if not target:
            continue
        line.item = target
        # Keep original description for receipt clarity
        line.save(update_fields=["item"])
        moved[entry["code"]] = moved.get(entry["code"], 0) + 1

    return {"moved": moved, "canonical_ids": list(canonical_ids)}
