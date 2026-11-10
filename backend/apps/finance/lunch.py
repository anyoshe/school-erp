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


def ensure_meals_fee_defaults(school):
    """Ensure Meals category + optional Lunch fee item exist for the school."""
    from apps.finance.models import FeeCategory, FeeItem

    cat, cat_created = FeeCategory.objects.get_or_create(
        school=school,
        name=MEALS_CATEGORY_NAME,
        defaults={
            "description": "Student lunch and catering charges",
            "is_mandatory": False,
            "display_order": 55,
        },
    )
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
    return {"category": cat, "item": item, "category_created": cat_created, "item_created": item_created}


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
