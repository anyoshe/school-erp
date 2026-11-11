"""Lunch / meals program helpers built on FeeItem optionals + LunchEnrollment."""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Q, Sum


MEALS_CATEGORY_NAME = "Meals & catering"
LUNCH_ITEM_NAME = "Lunch / meals"


def is_meals_fee_item(item) -> bool:
    if item is None:
        return False
    name = (getattr(item, "name", None) or "").lower()
    cat = getattr(item, "category", None)
    cat_name = (getattr(cat, "name", None) or "").lower() if cat else ""
    keys = ("meal", "lunch", "catering", "feeding")
    return any(k in name for k in keys) or any(k in cat_name for k in keys)


def _meals_like_categories(school):
    """All fee categories that look like meals/catering (including empty duplicates)."""
    from apps.finance.models import FeeCategory

    return list(
        FeeCategory.objects.filter(school=school).filter(
            Q(name__icontains="meal")
            | Q(name__icontains="catering")
            | Q(name__icontains="lunch")
            | Q(name__icontains="feeding")
        )
    )


def consolidate_meals_categories(school):
    """
    Keep a single "Meals & catering" category with items; merge/delete empty duplicates.

    - Prefer the category already named MEALS_CATEGORY_NAME
    - Else prefer the one with the most fee items
    - Move items + expense links from losers → winner
    - Delete empty leftover categories
    """
    from apps.finance.models import FeeCategory, FeeItem, Expense

    cats = _meals_like_categories(school)
    if not cats:
        return {"kept": None, "merged": 0, "deleted": 0, "items_moved": 0}

    def sort_key(c):
        exact = 1 if (c.name or "").strip() == MEALS_CATEGORY_NAME else 0
        n_items = c.items.count()
        return (exact, n_items)

    cats_sorted = sorted(cats, key=sort_key, reverse=True)
    keep = cats_sorted[0]

    # Canonical name on the survivor (unique_together school+name)
    if (keep.name or "").strip() != MEALS_CATEGORY_NAME:
        clash = (
            FeeCategory.objects.filter(school=school, name=MEALS_CATEGORY_NAME)
            .exclude(pk=keep.pk)
            .first()
        )
        if clash is None:
            keep.name = MEALS_CATEGORY_NAME
            keep.description = keep.description or "Student lunch and catering charges"
            keep.is_mandatory = False
            keep.save(update_fields=["name", "description", "is_mandatory"])
        else:
            # Exact-named empty/other exists — prefer that as keep if it has >= items
            if clash.items.count() >= keep.items.count():
                cats_sorted = [clash] + [c for c in cats_sorted if c.pk != clash.pk]
                keep = clash
            else:
                # Move clash items into keep then delete clash so we can rename
                pass

    merged = 0
    deleted = 0
    items_moved = 0

    for other in list(FeeCategory.objects.filter(school=school).filter(
        Q(name__icontains="meal")
        | Q(name__icontains="catering")
        | Q(name__icontains="lunch")
        | Q(name__icontains="feeding")
    ).exclude(pk=keep.pk)):
        for item in list(other.items.all()):
            # Merge into same-named item on keep when possible
            twin = FeeItem.objects.filter(category=keep, name=item.name).first()
            if twin is None:
                item.category = keep
                item.save(update_fields=["category"])
                items_moved += 1
            else:
                # Repoint invoice lines / structure refs that use this item id if any
                try:
                    from apps.finance.models import InvoiceLine, FeeStructure, FeeStructureItem
                    InvoiceLine.objects.filter(item=item).update(item=twin)
                    for si in list(FeeStructureItem.objects.filter(item=item)):
                        if FeeStructureItem.objects.filter(
                            structure=si.structure, item=twin
                        ).exists():
                            si.delete()
                        else:
                            si.item = twin
                            si.save(update_fields=["item"])
                    for st in FeeStructure.objects.filter(available_optional_items=item):
                        st.available_optional_items.remove(item)
                        st.available_optional_items.add(twin)
                    # Student fee assignment selected optionals
                    try:
                        from apps.finance.models import StudentFeeAssignment
                        for asg in StudentFeeAssignment.objects.filter(selected_optional_items=item):
                            asg.selected_optional_items.remove(item)
                            asg.selected_optional_items.add(twin)
                    except Exception:
                        pass
                except Exception:
                    pass
                item.delete()
                items_moved += 1
        # Expenses linked to the duplicate category
        try:
            Expense.objects.filter(related_fee_category=other).update(
                related_fee_category=keep
            )
        except Exception:
            pass
        other.delete()
        merged += 1
        deleted += 1

    # Ensure canonical name after merges
    if (keep.name or "").strip() != MEALS_CATEGORY_NAME:
        if not FeeCategory.objects.filter(school=school, name=MEALS_CATEGORY_NAME).exclude(pk=keep.pk).exists():
            keep.name = MEALS_CATEGORY_NAME
            keep.save(update_fields=["name"])

    keep.refresh_from_db()
    return {
        "kept": keep,
        "merged": merged,
        "deleted": deleted,
        "items_moved": items_moved,
    }


def ensure_meals_fee_defaults(school):
    """Ensure one Meals & catering category + optional Lunch fee item (no empty duplicates)."""
    from apps.finance.models import FeeCategory, FeeItem

    consolid = consolidate_meals_categories(school)
    cat = consolid.get("kept")
    cat_created = False
    if cat is None:
        cat, cat_created = FeeCategory.objects.get_or_create(
            school=school,
            name=MEALS_CATEGORY_NAME,
            defaults={
                "description": "Student lunch and catering charges",
                "is_mandatory": False,
                "display_order": 55,
            },
        )
    else:
        # Normalize flags on survivor
        dirty = False
        if cat.is_mandatory:
            cat.is_mandatory = False
            dirty = True
        if not (cat.description or "").strip():
            cat.description = "Student lunch and catering charges"
            dirty = True
        if dirty:
            cat.save()

    item, item_created = FeeItem.objects.get_or_create(
        category=cat,
        name=LUNCH_ITEM_NAME,
        defaults={
            "description": "School lunch / meals program",
            "frequency": "per_term",
            "is_active": True,
            "is_optional": True,
        },
    )
    # Keep optional flag true for lunch package item
    if not item.is_optional or not item.is_active:
        item.is_optional = True
        item.is_active = True
        item.save(update_fields=["is_optional", "is_active"])

    # Delete any leftover empty meals-like categories (no items)
    removed_empty = 0
    for empty in FeeCategory.objects.filter(school=school).filter(
        Q(name__icontains="meal")
        | Q(name__icontains="catering")
        | Q(name__icontains="lunch")
        | Q(name__icontains="feeding")
    ).exclude(pk=cat.pk):
        if empty.items.count() == 0:
            try:
                from apps.finance.models import Expense
                Expense.objects.filter(related_fee_category=empty).update(
                    related_fee_category=cat
                )
            except Exception:
                pass
            empty.delete()
            removed_empty += 1

    return {
        "category": cat,
        "item": item,
        "category_created": cat_created,
        "item_created": item_created,
        "consolidated": consolid,
        "removed_empty": removed_empty,
    }


def active_lunch_enrollment(student, school=None):
    from apps.finance.models import LunchEnrollment

    qs = LunchEnrollment.objects.filter(student=student, status=LunchEnrollment.Status.ACTIVE)
    if school is not None:
        qs = qs.filter(school=school)
    return qs.order_by("-updated_at").first()


def meals_items_for_structure(structure):
    """Fee items on a structure that count as meals/lunch."""
    if structure is None:
        return []
    items = []
    for si in structure.structure_items.select_related("item", "item__category").all():
        if is_meals_fee_item(si.item):
            items.append(si.item)
    # Also optional M2M set
    for item in structure.available_optional_items.select_related("category").all():
        if is_meals_fee_item(item) and item not in items:
            items.append(item)
    return items


def apply_lunch_enrollment_to_assignment(assignment) -> list:
    """
    If student has ACTIVE lunch enrollment, ensure meals optional items on the
    assignment's structure are selected. Returns list of item ids added.
    """
    if assignment is None or not assignment.fee_structure_id:
        return []
    student = assignment.student
    school = getattr(student, "school", None)
    if school is None:
        return []
    ensure_meals_fee_defaults(school)
    enr = active_lunch_enrollment(student, school)
    if enr is None:
        return []

    structure = assignment.fee_structure
    meals_items = meals_items_for_structure(structure)
    # If structure has no meals line yet, attach school default lunch item as optional available
    if not meals_items:
        from apps.finance.models import FeeItem, FeeStructureItem

        defaults = ensure_meals_fee_defaults(school)
        lunch_item = defaults["item"]
        # Add to structure optional set so clearance can bill if amount set on structure
        structure.available_optional_items.add(lunch_item)
        # If enrollment has an amount and no structure line, create a structure line
        if enr.amount and Decimal(str(enr.amount)) > 0:
            FeeStructureItem.objects.get_or_create(
                fee_structure=structure,
                item=lunch_item,
                defaults={"amount": enr.amount},
            )
        meals_items = [lunch_item]

    added = []
    current = set(assignment.selected_optional_items.values_list("id", flat=True))
    for item in meals_items:
        if item.id not in current:
            assignment.selected_optional_items.add(item)
            added.append(item.id)
    return added


def meals_kitty_summary(school):
    """Income vs kitchen spend for Meals fee group (approximate kitty)."""
    from apps.finance.models import InvoiceLine, Payment, Expense, FeeCategory, FeeItem

    ensure_meals_fee_defaults(school)
    cat_ids = list(
        FeeCategory.objects.filter(school=school)
        .filter(
            Q(name__icontains="meal")
            | Q(name__icontains="lunch")
            | Q(name__icontains="cater")
        )
        .values_list("id", flat=True)
    )
    item_ids = list(FeeItem.objects.filter(category_id__in=cat_ids).values_list("id", flat=True))
    # Also items by name
    item_ids = list(
        set(item_ids)
        | set(
            FeeItem.objects.filter(category__school=school)
            .filter(Q(name__icontains="lunch") | Q(name__icontains="meal"))
            .values_list("id", flat=True)
        )
    )

    # Collected: sum of invoice line amounts that are meals and proportionally paid is hard;
    # use sum of payment line_allocations matching descriptions, else invoice lines amount_paid share.
    invoiced = (
        InvoiceLine.objects.filter(invoice__school=school, item_id__in=item_ids).aggregate(
            s=Sum("amount")
        )["s"]
        or Decimal("0")
    )
    # Payments with allocations
    collected = Decimal("0")
    for p in Payment.objects.filter(invoice__school=school).only("amount", "line_allocations")[:5000]:
        allocs = getattr(p, "line_allocations", None) or []
        if isinstance(allocs, list) and allocs:
            for a in allocs:
                if not isinstance(a, dict):
                    continue
                desc = (a.get("description") or "").lower()
                cat = (a.get("category") or "").lower()
                if any(k in desc or k in cat for k in ("meal", "lunch", "cater")):
                    collected += Decimal(str(a.get("amount") or 0))
        # else skip unallocated for kitty precision

    kitchen_expense = (
        Expense.objects.filter(school=school)
        .filter(
            Q(category__name__icontains="meal")
            | Q(category__name__icontains="kitchen")
            | Q(related_fee_category_id__in=cat_ids)
        )
        .aggregate(s=Sum("amount"))["s"]
        or Decimal("0")
    )

    return {
        "meals_invoiced": str(invoiced),
        "meals_collected_allocated": str(collected),
        "kitchen_expenses": str(kitchen_expense),
        "estimated_surplus": str(Decimal(collected) - Decimal(kitchen_expense)),
        "fee_item_ids": item_ids,
    }
