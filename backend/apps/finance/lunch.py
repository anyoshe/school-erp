"""Lunch / meals program helpers built on FeeItem optionals + LunchEnrollment."""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Q, Sum


MEALS_CATEGORY_NAME = "Meals & catering"
LUNCH_ITEM_NAME = "Lunch / meals"


def looks_like_meals_text(text) -> bool:
    """True if a free-text name/description is meals/lunch/catering related."""
    s = (text or "").strip().lower()
    if not s:
        return False
    keys = ("meal", "lunch", "catering", "feeding", "kitchen", "canteen")
    return any(k in s for k in keys)


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


def resolve_canonical_meals_item(school):
    """Single school Lunch / meals FeeItem under Meals & catering."""
    result = ensure_meals_fee_defaults(school)
    return result["item"]


def rehome_stray_meals_invoice_lines(school) -> int:
    """
    Point invoice lines that look like meals but sit under Additional charges
    (or other non-meals categories) at the canonical Lunch / meals item.
    Does not change amounts — only item FK for reporting / kitty.
    """
    from apps.finance.models import InvoiceLine, FeeCategory

    lunch = resolve_canonical_meals_item(school)
    meals_cat_ids = set(
        FeeCategory.objects.filter(school=school)
        .filter(
            Q(name__icontains="meal")
            | Q(name__icontains="lunch")
            | Q(name__icontains="cater")
            | Q(name__icontains="feeding")
        )
        .values_list("id", flat=True)
    )
    qs = InvoiceLine.objects.filter(invoice__school=school).select_related("item", "item__category")
    moved = 0
    for line in qs:
        item = line.item
        desc = line.description or ""
        name = getattr(item, "name", "") if item else ""
        cat_id = getattr(getattr(item, "category", None), "id", None)
        if item and cat_id in meals_cat_ids and item.id == lunch.id:
            continue
        if looks_like_meals_text(desc) or looks_like_meals_text(name):
            if not item or item.id != lunch.id:
                line.item = lunch
                line.save(update_fields=["item"])
                moved += 1
    return moved


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


def structure_meals_amount(structure) -> Decimal:
    """
    Amount for Lunch/meals from the fee structure (first positive meals line).
    This is the default full package when the structure has the meal option.
    """
    if structure is None:
        return Decimal("0")
    best = Decimal("0")
    for si in structure.structure_items.select_related("item", "item__category").all():
        if not is_meals_fee_item(si.item):
            continue
        amt = Decimal(str(si.amount or 0))
        if amt > best:
            best = amt
    return best


def suggested_meals_amount_for_student(student) -> dict:
    """
    Prefer fee-structure meals amount; enrollment amount is only an override
    when set lower (discount) or when structure has no meals line.
    """
    from apps.finance.models import StudentFeeAssignment

    school = getattr(student, "school", None)
    out = {
        "amount": Decimal("0"),
        "source": "none",
        "structure_amount": Decimal("0"),
        "enrollment_amount": Decimal("0"),
        "item_id": None,
        "item_name": LUNCH_ITEM_NAME,
        "structure_id": None,
        "structure_name": None,
    }
    if school is None:
        return out
    defaults = ensure_meals_fee_defaults(school)
    out["item_id"] = str(defaults["item"].id)
    out["item_name"] = defaults["item"].name

    structure = None
    assignment = StudentFeeAssignment.objects.filter(student=student).select_related(
        "fee_structure"
    ).first()
    if assignment and assignment.fee_structure_id:
        structure = assignment.fee_structure
    if structure is None:
        structure = getattr(student, "fee_structure", None)
    if structure is None:
        try:
            from apps.finance.clearance import find_fee_structure
            structure = find_fee_structure(student)
        except Exception:
            structure = None

    struct_amt = structure_meals_amount(structure) if structure else Decimal("0")
    out["structure_amount"] = struct_amt
    if structure:
        out["structure_id"] = str(structure.id)
        out["structure_name"] = structure.name

    enr = active_lunch_enrollment(student, school)
    enr_amt = Decimal(str(enr.amount or 0)) if enr else Decimal("0")
    plan = (getattr(enr, "plan_type", None) or "TERM").upper() if enr else "TERM"
    if enr and plan == "MONTHLY" and enr_amt > 0:
        enr_amt = (enr_amt * Decimal("3")).quantize(Decimal("0.01"))
    out["enrollment_amount"] = enr_amt

    # Default = structure. Override only if enrollment has a positive amount
    # (discounted or custom package for this learner).
    if struct_amt > 0 and (enr_amt <= 0 or enr_amt >= struct_amt):
        out["amount"] = struct_amt
        out["source"] = "structure"
    elif enr_amt > 0:
        out["amount"] = enr_amt
        out["source"] = "enrollment_override" if struct_amt > 0 else "enrollment"
    elif struct_amt > 0:
        out["amount"] = struct_amt
        out["source"] = "structure"
    return out


def term_commitment_amount(enr) -> Decimal:
    """
    Full package the parent owes once subscribed.
    TERM: enrollment.amount is the term total.
    MONTHLY: enrollment.amount is monthly; term commitment = monthly × 3.
    (Kenya-style three months per term — presentation only; billing is the full total.)
    """
    if enr is None:
        return Decimal("0")
    amt = Decimal(str(enr.amount or 0))
    if amt <= 0:
        return Decimal("0")
    plan = (getattr(enr, "plan_type", None) or "TERM").upper()
    if plan == "MONTHLY":
        return (amt * Decimal("3")).quantize(Decimal("0.01"))
    # TERM (and legacy weekly/daily treated as full package amount entered)
    return amt


def monthly_guide_amount(enr) -> Decimal:
    """What to tell parents per month (term total ÷ 3). Not a separate pro-rata bill."""
    total = term_commitment_amount(enr)
    if total <= 0:
        return Decimal("0")
    plan = (getattr(enr, "plan_type", None) or "TERM").upper()
    if plan == "MONTHLY":
        return Decimal(str(enr.amount or 0))
    return (total / Decimal("3")).quantize(Decimal("0.01"))


def apply_lunch_enrollment_to_assignment(assignment) -> list:
    """
    ACTIVE lunch subscription → select Lunch / meals on the assignment.
    Full package amount only (no day-counting). Returns item ids added.
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

    from apps.finance.models import FeeStructureItem

    structure = assignment.fee_structure
    defaults = ensure_meals_fee_defaults(school)
    lunch_item = defaults["item"]
    meals_items = meals_items_for_structure(structure)
    if not meals_items:
        structure.available_optional_items.add(lunch_item)
        meals_items = [lunch_item]

    # Prefer structure meals price; only fill structure line if missing/zero
    struct_amt = structure_meals_amount(structure)
    commitment = struct_amt if struct_amt > 0 else term_commitment_amount(enr)
    if commitment > 0:
        si = FeeStructureItem.objects.filter(structure=structure, item=lunch_item).first()
        if si is None:
            for other in FeeStructureItem.objects.filter(
                structure=structure, item__in=meals_items
            ):
                si = other
                break
        if si is None:
            FeeStructureItem.objects.create(
                structure=structure, item=lunch_item, amount=commitment
            )
        elif Decimal(str(si.amount or 0)) <= 0:
            si.amount = commitment
            si.save(update_fields=["amount"])
        structure.available_optional_items.add(lunch_item)

    added = []
    current = set(assignment.selected_optional_items.values_list("id", flat=True))
    for item in meals_items:
        if item.id not in current:
            assignment.selected_optional_items.add(item)
            added.append(item.id)
    if lunch_item.id not in current and lunch_item.id not in added:
        assignment.selected_optional_items.add(lunch_item)
        added.append(lunch_item.id)
    return added


def ensure_lunch_invoice_line(student, user=None) -> dict:
    """
    After subscribe: bill Lunch / meals at structure amount (or discounted override).
    Full package — no day-counting.
    """
    from apps.finance.models import InvoiceLine, StudentFeeAssignment
    from apps.finance.clearance import add_extra_fee_line

    school = getattr(student, "school", None)
    if school is None:
        return {"ok": False, "detail": "no school"}
    enr = active_lunch_enrollment(student, school)
    if enr is None:
        return {"ok": False, "detail": "no active enrollment"}

    defaults = ensure_meals_fee_defaults(school)
    lunch_item = defaults["item"]
    suggested = suggested_meals_amount_for_student(student)
    commitment = Decimal(str(suggested.get("amount") or 0))

    assignment = StudentFeeAssignment.objects.filter(student=student).first()
    if assignment:
        apply_lunch_enrollment_to_assignment(assignment)

    # Already has a meals/lunch line on any invoice?
    existing = InvoiceLine.objects.filter(
        invoice__student=student, item=lunch_item
    ).first()
    if existing:
        return {
            "ok": True,
            "already": True,
            "line_id": str(existing.id),
            "amount": float(existing.amount or 0),
            "commitment": float(commitment),
            "monthly_guide": float((commitment / Decimal("3")).quantize(Decimal("0.01")) if commitment else 0),
            "source": suggested.get("source"),
            "structure_amount": float(suggested.get("structure_amount") or 0),
        }

    if commitment <= 0:
        return {
            "ok": False,
            "detail": "Add Lunch/meals on the fee structure with an amount, or enter a package amount.",
            "monthly_guide": 0,
            "source": suggested.get("source"),
        }

    try:
        result = add_extra_fee_line(
            student,
            description=LUNCH_ITEM_NAME,
            amount=commitment,
            user=user,
            fee_item_id=lunch_item.id,
        )
        # add_extra_fee_line returns (line, invoice, billing) or line
        line = result[0] if isinstance(result, (tuple, list)) else result
        return {
            "ok": True,
            "already": False,
            "line_id": str(getattr(line, "id", "")),
            "amount": float(commitment),
            "commitment": float(commitment),
            "monthly_guide": float(monthly_guide_amount(enr)),
        }
    except Exception as exc:
        return {"ok": False, "detail": str(exc), "commitment": float(commitment)}


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
