"""
Canonical optional fee items for clearance / returning bills.

Keeps Meals, Books, Assessment books, Uniforms, Transport, and Miscellaneous
stable so cashiers select existing items instead of inventing new names.
"""
from __future__ import annotations


# code -> category/item + keywords for free text / legacy aliases
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
        "keywords": ("textbook", "text book", "course book", "workbook", "text books"),
        "description": "Textbooks and learning materials",
        "display_order": 60,
    },
    {
        "code": "assessment_books",
        "category": "Books & learning materials",
        "item": "Assessment books",
        "keywords": (
            "assessment book",
            "assessment books",
            "assessmentbook",
            "assessmentbooks",
            "assesment book",
            "assesment books",
            "exam book",
            "exam books",
        ),
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


def _norm(text: str) -> str:
    return " ".join((text or "").strip().lower().split())


def _text_match(text: str, keywords: tuple) -> bool:
    s = _norm(text)
    if not s:
        return False
    # Prefer longer keywords first so "assessment book" wins over "book"
    for k in sorted(keywords, key=len, reverse=True):
        if k in s:
            return True
    return False


def match_catalog_entry(text: str):
    """Return best CANONICAL_OPTIONALS entry for free text, or None."""
    s = _norm(text)
    if not s:
        return None
    # assessment before general books; longer keywords first
    ordered = sorted(
        CANONICAL_OPTIONALS,
        key=lambda e: (
            0 if e["code"] == "assessment_books" else 1,
            -max(len(k) for k in e["keywords"]),
        ),
    )
    for entry in ordered:
        if _text_match(s, entry["keywords"]):
            return entry
    # Bare "books" (not assessment) → textbooks
    if "book" in s and "assessment" not in s and "exam" not in s:
        for entry in CANONICAL_OPTIONALS:
            if entry["code"] == "books":
                return entry
    return None


def ensure_optional_fee_catalog(school) -> list:
    """
    Ensure canonical categories + items exist. Returns list of dicts for API/UI.
    """
    from apps.finance.models import FeeCategory, FeeItem
    from apps.finance.lunch import ensure_meals_fee_defaults

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

        item, _created = FeeItem.objects.get_or_create(
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


def _find_alias_items(school, entry, canonical_id):
    """FeeItems for this school whose name matches keywords but is not the canonical row."""
    from apps.finance.models import FeeItem

    aliases = []
    for fi in FeeItem.objects.filter(category__school=school).select_related("category"):
        if str(fi.id) == str(canonical_id):
            continue
        # Match on item name (and category name as weak signal)
        text = f"{fi.name} {fi.category.name if fi.category_id else ''}"
        matched = match_catalog_entry(text)
        if matched and matched["code"] == entry["code"]:
            aliases.append(fi)
        elif _text_match(fi.name, entry["keywords"]):
            aliases.append(fi)
    return aliases


def merge_alias_fee_items(school) -> dict:
    """
    Point all alias FeeItems (e.g. 'Assessment Book') at the canonical
    'Assessment books' item: invoice lines, structure lines, M2M, expenses.
    Then deactivate aliases so cashiers only see one selection.
    """
    from apps.finance.models import (
        Expense,
        FeeItem,
        FeeStructure,
        FeeStructureItem,
        InvoiceLine,
        StudentFeeAssignment,
    )

    catalog = ensure_optional_fee_catalog(school)
    by_code = {c["code"]: c for c in catalog}
    report = {}

    for entry in CANONICAL_OPTIONALS:
        code = entry["code"]
        target_id = by_code[code]["fee_item_id"]
        target = FeeItem.objects.filter(pk=target_id).first()
        if not target:
            continue
        aliases = _find_alias_items(school, entry, target_id)
        if not aliases:
            report[code] = {"aliases": 0, "invoice_lines": 0, "structure_items": 0}
            continue

        inv_n = 0
        str_n = 0
        for alias in aliases:
            # Invoice lines
            inv_n += InvoiceLine.objects.filter(invoice__school=school, item=alias).update(
                item=target
            )
            # Structure prices: move or merge if both exist on same structure
            for si in FeeStructureItem.objects.filter(
                structure__school=school, item=alias
            ):
                existing = FeeStructureItem.objects.filter(
                    structure_id=si.structure_id, item=target
                ).first()
                if existing:
                    # Keep higher amount or sum? Prefer keep existing target row; drop alias
                    si.delete()
                else:
                    si.item = target
                    si.save(update_fields=["item"])
                str_n += 1
            # M2M available_optional_items & selected_optional_items
            for struct in FeeStructure.objects.filter(
                school=school, available_optional_items=alias
            ):
                struct.available_optional_items.remove(alias)
                struct.available_optional_items.add(target)
            for asn in StudentFeeAssignment.objects.filter(
                student__school=school, selected_optional_items=alias
            ):
                asn.selected_optional_items.remove(alias)
                asn.selected_optional_items.add(target)
            # Expenses
            Expense.objects.filter(school=school, related_fee_item=alias).update(
                related_fee_item=target
            )
            # Deactivate alias so it disappears from pickers
            if alias.is_active:
                alias.is_active = False
                alias.save(update_fields=["is_active"])

        report[code] = {
            "aliases": len(aliases),
            "alias_names": [a.name for a in aliases],
            "invoice_lines": inv_n,
            "structure_items": str_n,
        }

    return report


def rehome_stray_optional_invoice_lines(school) -> dict:
    """
    1) Merge alias FeeItems (Assessment Book → Assessment books).
    2) Re-point any remaining invoice lines matched by description keywords.
    """
    from apps.finance.models import InvoiceLine, FeeItem

    merge_report = merge_alias_fee_items(school)

    catalog = ensure_optional_fee_catalog(school)
    by_code = {c["code"]: c for c in catalog}
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
        if entry["code"] == "misc" and not _text_match(
            text, ("misc", "miscellaneous", "sundry")
        ):
            continue
        target = FeeItem.objects.filter(pk=target_id).first()
        if not target:
            continue
        line.item = target
        line.save(update_fields=["item"])
        moved[entry["code"]] = moved.get(entry["code"], 0) + 1

    return {
        "merged_aliases": merge_report,
        "moved_lines": moved,
        "canonical_ids": list(canonical_ids),
    }
