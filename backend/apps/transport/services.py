"""
Transport ↔ Finance glue.

Routes carry term_amount (distance-based). When a learner is on transport,
clearance / billing posts onto the canonical "School transport" fee item.
"""
from __future__ import annotations

from decimal import Decimal


def ensure_transport_fee_item(school):
    """Return canonical Transport / School transport FeeItem for the school."""
    from apps.finance.fee_catalog import ensure_optional_fee_catalog

    catalog = ensure_optional_fee_catalog(school)
    for row in catalog:
        if row.get("code") == "transport" or (
            "transport" in (row.get("name") or "").lower()
        ):
            from apps.finance.models import FeeItem

            item = FeeItem.objects.filter(pk=row["fee_item_id"]).first()
            if item:
                return item
    # Fallback create via catalog defaults
    from apps.finance.fee_catalog import CANONICAL_OPTIONALS, ensure_optional_fee_catalog

    ensure_optional_fee_catalog(school)
    from apps.finance.models import FeeItem, FeeCategory

    cat, _ = FeeCategory.objects.get_or_create(
        school=school,
        name="Transport",
        defaults={"is_mandatory": False, "display_order": 70},
    )
    item, _ = FeeItem.objects.get_or_create(
        category=cat,
        name="School transport",
        defaults={"is_optional": True, "description": "School transport / bus"},
    )
    return item


def routes_for_school(school, active_only=True):
    from apps.transport.models import Route

    qs = Route.objects.filter(school=school)
    if active_only:
        qs = qs.filter(is_active=True)
    return qs.order_by("sort_order", "name")


def routes_payload(school, active_only=True):
    out = []
    for r in routes_for_school(school, active_only=active_only):
        out.append(
            {
                "id": str(r.id),
                "name": r.name,
                "description": r.description or "",
                "distance_km": float(r.distance_km) if r.distance_km is not None else None,
                "term_amount": float(r.term_amount or 0),
                "is_active": bool(r.is_active),
                "sort_order": r.sort_order,
            }
        )
    return out


def active_assignment_for_student(student):
    from apps.transport.models import StudentAssignment

    return (
        StudentAssignment.objects.filter(student=student, is_active=True)
        .select_related("route")
        .order_by("-assigned_at")
        .first()
    )


def transport_optional_for_student(student):
    """
    Payload for clearance: available routes + any active assignment amount.
    """
    item = ensure_transport_fee_item(student.school)
    routes = routes_payload(student.school, active_only=True)
    assignment = active_assignment_for_student(student)
    assigned = None
    if assignment and assignment.route_id:
        assigned = {
            "assignment_id": str(assignment.id),
            "route_id": str(assignment.route_id),
            "route_name": assignment.route.name if assignment.route else "",
            "amount": float(assignment.effective_amount()),
            "pickup_point": assignment.pickup_point or "",
            "dropoff_point": assignment.dropoff_point or "",
        }
    return {
        "fee_item_id": str(item.id),
        "item_name": item.name,
        "routes": routes,
        "assigned": assigned,
        # Convenience default: assigned route amount, else first route
        "default_amount": (
            assigned["amount"]
            if assigned
            else (routes[0]["term_amount"] if routes else 0)
        ),
        "default_route_id": (
            assigned["route_id"] if assigned else (routes[0]["id"] if routes else None)
        ),
    }


def subscribe_student(
    student,
    route,
    *,
    user=None,
    vehicle=None,
    pickup_point="",
    dropoff_point="",
    academic_year="",
    term="",
    amount_override=None,
    bill=True,
):
    """
    Activate transport on a route. Deactivates prior active assignments.
    Optionally posts the term amount onto the open invoice (clearance flow).
    """
    from apps.transport.models import StudentAssignment
    from apps.finance.clearance import add_extra_fee_line

    StudentAssignment.objects.filter(student=student, is_active=True).update(is_active=False)

    amount = amount_override
    if amount is None:
        amount = route.term_amount

    asg = StudentAssignment.objects.create(
        school=student.school,
        student=student,
        route=route,
        vehicle=vehicle,
        pickup_point=pickup_point or "",
        dropoff_point=dropoff_point or "",
        academic_year=academic_year or "",
        term=term or "",
        amount_override=amount_override,
        is_active=True,
    )

    line = None
    if bill and amount and Decimal(str(amount)) > 0:
        item = ensure_transport_fee_item(student.school)
        desc = f"Transport – {route.name}"
        if route.distance_km is not None:
            desc += f" ({route.distance_km} km)"
        line, _inv, _billing = add_extra_fee_line(
            student,
            description=desc,
            amount=Decimal(str(amount)),
            user=user,
            fee_item_id=str(item.id),
        )
    return asg, line
