"""
R5 — Operations early-warning (inventory / kitchen burn-rate).

1. Low stock — quantity_on_hand <= reorder_level
2. Burn anomaly — avg daily OUT over 7 days > expected_daily_use * 1.25
   (when expected_daily_use > 0 and enough OUT movements)
3. Asset damage spike — Damaged/Lost assets (informational if any)

Gracefully no-ops when consumables are not set up yet.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.risks.common import close_stale, upsert_alert

BURN_MULTIPLIER = Decimal("1.25")
BURN_WINDOW_DAYS = 7


def scan_ops_risks_for_school(school) -> dict:
    from apps.inventory.models import Asset, ConsumableItem, StockMovement

    today = timezone.localdate()
    start = today - timedelta(days=BURN_WINDOW_DAYS)
    keep: set[str] = set()
    created_n = updated_n = 0

    items = list(
        ConsumableItem.objects.filter(school=school, is_active=True)
    )
    if not items:
        # Still check damaged assets lightly
        damaged = Asset.objects.filter(school=school, status__iregex=r"damaged|lost").count()
        if damaged >= 3:
            fp = "ops:assets:damaged"
            obj, created = upsert_alert(
                school=school,
                fingerprint=fp,
                category="OPS",
                severity="LOW",
                title=f"{damaged} assets marked damaged/lost",
                detail="Review asset register — write-offs may need finance approval.",
                metrics={"damaged_or_lost": damaged},
                action_path="/dashboard/modules/inventory",
            )
            keep.add(fp)
            created_n += int(created)
            updated_n += int(not created)
        closed = close_stale(school, keep, category="OPS")
        return {
            "school_id": str(school.id),
            "created": created_n,
            "updated": updated_n,
            "resolved_stale": closed,
            "skipped": "no_consumables" if not items else None,
            "open_fingerprints": len(keep),
        }

    for item in items:
        # 1) Low stock
        qoh = Decimal(str(item.quantity_on_hand or 0))
        reorder = Decimal(str(item.reorder_level or 0))
        if reorder > 0 and qoh <= reorder:
            fp = f"ops:lowstock:{item.id}"
            sev = "HIGH" if qoh <= 0 else "MEDIUM"
            obj, created = upsert_alert(
                school=school,
                fingerprint=fp,
                category="OPS",
                severity=sev,
                title=f"Low stock: {item.name}",
                detail=(
                    f"On hand {float(qoh):g} {item.unit} ≤ reorder level {float(reorder):g} {item.unit}. "
                    "Reorder before kitchen/ops disruption."
                ),
                metrics={
                    "item_id": item.id,
                    "quantity_on_hand": float(qoh),
                    "reorder_level": float(reorder),
                    "unit": item.unit,
                },
                action_path="/dashboard/modules/inventory",
            )
            keep.add(fp)
            created_n += int(created)
            updated_n += int(not created)

        # 2) Burn anomaly
        expected = Decimal(str(item.expected_daily_use or 0))
        if expected > 0:
            out_sum = (
                StockMovement.objects.filter(
                    school=school,
                    item=item,
                    kind=StockMovement.Kind.OUT,
                    movement_date__gte=start,
                    movement_date__lte=today,
                ).aggregate(t=Sum("quantity"))["t"]
                or 0
            )
            out_sum = Decimal(str(out_sum))
            avg_daily = out_sum / Decimal(str(BURN_WINDOW_DAYS))
            if avg_daily > expected * BURN_MULTIPLIER:
                fp = f"ops:burn:{item.id}"
                obj, created = upsert_alert(
                    school=school,
                    fingerprint=fp,
                    category="OPS",
                    severity="HIGH" if avg_daily > expected * Decimal("2") else "MEDIUM",
                    title=f"High burn-rate: {item.name}",
                    detail=(
                        f"Avg daily use {float(avg_daily):.1f} {item.unit} over {BURN_WINDOW_DAYS}d "
                        f"vs expected {float(expected):g} {item.unit}/day "
                        f"({float((avg_daily/expected)*100):.0f}% of plan). Check waste or under-counted meals."
                    ),
                    metrics={
                        "item_id": item.id,
                        "avg_daily_out": float(avg_daily),
                        "expected_daily_use": float(expected),
                        "window_days": BURN_WINDOW_DAYS,
                        "total_out": float(out_sum),
                    },
                    action_path="/dashboard/modules/inventory",
                )
                keep.add(fp)
                created_n += int(created)
                updated_n += int(not created)

    damaged = Asset.objects.filter(school=school, status__iregex=r"damaged|lost").count()
    if damaged >= 3:
        fp = "ops:assets:damaged"
        obj, created = upsert_alert(
            school=school,
            fingerprint=fp,
            category="OPS",
            severity="LOW",
            title=f"{damaged} assets marked damaged/lost",
            detail="Review asset register — write-offs may need finance approval.",
            metrics={"damaged_or_lost": damaged},
            action_path="/dashboard/modules/inventory",
        )
        keep.add(fp)
        created_n += int(created)
        updated_n += int(not created)

    closed = close_stale(school, keep, category="OPS")
    return {
        "school_id": str(school.id),
        "created": created_n,
        "updated": updated_n,
        "resolved_stale": closed,
        "open_fingerprints": len(keep),
        "consumables": len(items),
    }
