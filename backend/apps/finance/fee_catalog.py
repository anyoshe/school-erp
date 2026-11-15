"""
Canonical optional fee items for clearance / returning bills.

Keeps Meals, Books, Assessment books, Uniforms, Transport stable so cashiers
select existing items instead of inventing new names.

IMPORTANT:
- Never auto-merge into Miscellaneous from category name alone.
- Never treat core structure fees (tuition, exams, ICT, activity) as aliases.
- Alias merge matches FeeItem.name only, not category labels.
"""
from __future__ import annotations

# Optional catalog only — misc is selectable in UI but NEVER auto-rehomed
# from ambiguous text (that corrupted books previously).
CANONICAL_OPTIONALS = (
    {
        "code": "meals",
        "category": "Meals & catering",
        "item": "Lunch / meals",
        "keywords": ("meal", "lunch", "catering", "feeding", "kitchen", "canteen"),
        "description": "School lunch / meals program",
        "display_order": 55,
        "auto_rehome": True,
    },
    {
        "code": "books",
        "category": "Books & learning materials",
        "item": "Textbooks / books",
        "keywords": ("textbook", "text book", "course book", "workbook", "text books"),
        "description": "Textbooks and learning materials",
        "display_order": 60,
        "auto_rehome": True,
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
        "auto_rehome": True,
    },
    {
        "code": "uniforms",
        "category": "Uniforms & kit",
        "item": "School uniform",
        "keywords": ("uniform", "sports wear", "pe kit", "sweater", "tracksuit"),
        "description": "School uniform and kit",
        "display_order": 65,
        "auto_rehome": True,
    },
    {
        "code": "transport",
        "category": "Transport",
        "item": "School transport",
        "keywords": ("transport", "school bus", "boarding van"),
        "description": "School transport / bus",
        "display_order": 70,
        "auto_rehome": True,
    },
    {
        "code": "misc",
        "category": "Miscellaneous",
        "item": "Miscellaneous charges",
        # UI only — do not auto-rehome or merge aliases into this
        "keywords": ("miscellaneous charges",),
        "description": "General miscellaneous charges",
        "display_order": 90,
        "auto_rehome": False,
    },
)

OTHER_CATEGORY = "Other charges"

# Core structure fee names — never treat as optional aliases
_PROTECTED_NAME_FRAGMENTS = (
    "tuition",
    "school fee",
    "term fee",
    "activity fee",
    "exam",
    "ict",
    "co-curricular",
    "boarding fee",
    "development",
    "caution",
    "admission fee",
    "interview fee",
    "registration",
)


def _norm(text: str) -> str:
    return " ".join((text or "").strip().lower().split())


def _is_protected_fee_name(name: str) -> bool:
    s = _norm(name)
    if not s:
        return False
    # Single generic "fee" is core tuition-like in many schools
    if s in ("fee", "fees", "school fees", "tuition fees"):
        return True
    for frag in _PROTECTED_NAME_FRAGMENTS:
        if frag in s:
            # Allow "exam book" / "assessment" through
            if "book" in s:
                return False
            return True
    return False


def _text_match(text: str, keywords: tuple) -> bool:
    s = _norm(text)
    if not s:
        return False
    for k in sorted(keywords, key=len, reverse=True):
        if k in s:
            return True
    return False


def match_catalog_entry(text: str, *, allow_misc: bool = False):
    """
    Return best CANONICAL_OPTIONALS entry for free text, or None.
    assessment books beat generic books. Misc only if allow_misc=True.
    """
    s = _norm(text)
    if not s:
        return None
    if _is_protected_fee_name(s) and "book" not in s:
        return None

    ordered = sorted(
        CANONICAL_OPTIONALS,
        key=lambda e: (
            0 if e["code"] == "assessment_books" else 1,
            -max(len(k) for k in e["keywords"]),
        ),
    )
    for entry in ordered:
        if entry["code"] == "misc" and not allow_misc:
            continue
        if not entry.get("auto_rehome", True) and not allow_misc:
            continue
        if _text_match(s, entry["keywords"]):
            return entry
    return None


def ensure_optional_fee_catalog(school) -> list:
    """Ensure canonical categories + items exist. Returns list of dicts for API/UI."""
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
    """Resolve FeeItem for clearance/returning extra line (explicit id or keywords)."""
    from apps.finance.models import FeeItem

    ensure_optional_fee_catalog(school)

    if fee_item_id:
        item = FeeItem.objects.filter(
            pk=fee_item_id, category__school=school, is_active=True
        ).select_related("category").first()
        if item:
            return item, "selected"

    entry = match_catalog_entry(description, allow_misc=False)
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
    """
    FeeItems whose NAME (not category) matches this optional code, excluding
    the canonical row and protected core fees.
    """
    from apps.finance.models import FeeItem

    if not entry.get("auto_rehome", True):
        return []

    aliases = []
    for fi in FeeItem.objects.filter(category__school=school).select_related("category"):
        if str(fi.id) == str(canonical_id):
            continue
        name = fi.name or ""
        if _is_protected_fee_name(name):
            continue
        # NAME only — never category (was matching whole "Miscellaneous" category)
        matched = match_catalog_entry(name, allow_misc=False)
        if matched and matched["code"] == entry["code"]:
            aliases.append(fi)
        elif _text_match(name, entry["keywords"]):
            aliases.append(fi)
    return aliases


def merge_alias_fee_items(school, *, codes=None) -> dict:
    """
    Merge true aliases (Assessment Book → Assessment books) only.
    Does not touch misc. Does not delete structure amounts without consolidating.
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
    allowed = set(codes) if codes else None

    for entry in CANONICAL_OPTIONALS:
        code = entry["code"]
        if allowed is not None and code not in allowed:
            continue
        if not entry.get("auto_rehome", True):
            report[code] = {"skipped": "no auto_rehome"}
            continue

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
            inv_n += InvoiceLine.objects.filter(
                invoice__school=school, item=alias
            ).update(item=target)

            for si in list(
                FeeStructureItem.objects.filter(structure__school=school, item=alias)
            ):
                existing = FeeStructureItem.objects.filter(
                    structure_id=si.structure_id, item=target
                ).first()
                if existing:
                    # Keep financial total: take max of the two amounts
                    from decimal import Decimal
                    a = Decimal(str(existing.amount or 0))
                    b = Decimal(str(si.amount or 0))
                    if b > a:
                        existing.amount = b
                        existing.save(update_fields=["amount"])
                    si.delete()
                else:
                    si.item = target
                    si.save(update_fields=["item"])
                str_n += 1

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

            Expense.objects.filter(school=school, related_fee_item=alias).update(
                related_fee_item=target
            )
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


def repair_misc_misclassified_lines(school) -> dict:
    """
    Undo damage: lines (or deactivated items) that were incorrectly pointed at
    Miscellaneous charges. Restore from description / reactivated aliases.
    """
    from apps.finance.models import FeeItem, InvoiceLine

    catalog = ensure_optional_fee_catalog(school)
    by_code = {c["code"]: c for c in catalog}
    misc_id = by_code.get("misc", {}).get("fee_item_id")
    if not misc_id:
        return {"repaired": 0}

    misc_item = FeeItem.objects.filter(pk=misc_id).first()
    repaired = 0
    by_code_count = {}

    # Reactivate clear assessment-book aliases still in DB
    for entry in CANONICAL_OPTIONALS:
        if not entry.get("auto_rehome"):
            continue
        target = FeeItem.objects.filter(pk=by_code[entry["code"]]["fee_item_id"]).first()
        if not target:
            continue
        for fi in FeeItem.objects.filter(category__school=school, is_active=False):
            if str(fi.id) == str(target.id):
                continue
            if match_catalog_entry(fi.name or "", allow_misc=False) and match_catalog_entry(
                fi.name or "", allow_misc=False
            )["code"] == entry["code"]:
                # leave inactive after lines moved; merge will handle
                pass

    qs = InvoiceLine.objects.filter(invoice__school=school).select_related("item")
    for line in qs:
        item = line.item
        text = f"{line.description or ''} {getattr(item, 'name', '') or ''}"
        # Only repair rows currently on Misc OR description clearly optional
        on_misc = item and str(item.id) == str(misc_id)
        entry = match_catalog_entry(line.description or "", allow_misc=False)
        if not entry and on_misc:
            entry = match_catalog_entry(text, allow_misc=False)
        if not entry:
            continue
        # Do not leave assessment on misc
        if not on_misc and str(getattr(item, "id", "")) == by_code[entry["code"]][
            "fee_item_id"
        ]:
            continue
        if not on_misc:
            # Only force-fix when on misc or item name is misc
            iname = _norm(getattr(item, "name", "") or "")
            if "miscellaneous" not in iname and "misc" != iname:
                continue

        target = FeeItem.objects.filter(pk=by_code[entry["code"]]["fee_item_id"]).first()
        if not target or (item and item.id == target.id):
            continue
        line.item = target
        line.save(update_fields=["item"])
        repaired += 1
        by_code_count[entry["code"]] = by_code_count.get(entry["code"], 0) + 1

    # Merge assessment aliases only (safe)
    merge_report = merge_alias_fee_items(school, codes=["assessment_books", "meals", "uniforms", "transport", "books"])

    return {
        "repaired_from_misc": repaired,
        "repaired_by_code": by_code_count,
        "merged_aliases": merge_report,
        "misc_item_id": misc_id,
        "misc_name": getattr(misc_item, "name", None),
    }


def rehome_stray_optional_invoice_lines(school) -> dict:
    """
    Safe path:
    1) Repair misclassified misc lines
    2) Merge assessment/meals/etc aliases by NAME only
    3) Re-point invoice lines only when current item name matches optional keywords
       (never touch protected core fees; never auto-assign misc)
    """
    from apps.finance.models import InvoiceLine, FeeItem

    repair = repair_misc_misclassified_lines(school)

    catalog = ensure_optional_fee_catalog(school)
    by_code = {c["code"]: c for c in catalog}

    moved = {c["code"]: 0 for c in catalog}
    qs = InvoiceLine.objects.filter(invoice__school=school).select_related(
        "item", "item__category"
    )
    for line in qs:
        item = line.item
        if not item:
            # description-only recovery for null item
            entry = match_catalog_entry(line.description or "", allow_misc=False)
            if not entry:
                continue
            target = FeeItem.objects.filter(pk=by_code[entry["code"]]["fee_item_id"]).first()
            if target:
                line.item = target
                line.save(update_fields=["item"])
                moved[entry["code"]] = moved.get(entry["code"], 0) + 1
            continue

        if _is_protected_fee_name(item.name or ""):
            continue

        # Only rehome based on the FEE ITEM name (stable), not free description alone
        entry = match_catalog_entry(item.name or "", allow_misc=False)
        if not entry:
            continue
        target_id = by_code[entry["code"]]["fee_item_id"]
        if str(item.id) == str(target_id):
            continue
        target = FeeItem.objects.filter(pk=target_id).first()
        if not target:
            continue
        line.item = target
        line.save(update_fields=["item"])
        moved[entry["code"]] = moved.get(entry["code"], 0) + 1

    return {
        "repair": repair,
        "moved_lines": moved,
    }
