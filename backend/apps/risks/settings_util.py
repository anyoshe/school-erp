"""Load per-school risk thresholds (R7)."""
from __future__ import annotations

from decimal import Decimal


def get_risk_settings(school):
    from apps.risks.models import SchoolRiskSettings

    obj, _ = SchoolRiskSettings.objects.get_or_create(school=school)
    return obj


def settings_as_dict(s) -> dict:
    return {
        "enable_fee": s.enable_fee,
        "enable_attendance": s.enable_attendance,
        "enable_academic": s.enable_academic,
        "enable_ops": s.enable_ops,
        "mid_term_collection_threshold": float(s.mid_term_collection_threshold),
        "mid_term_elapsed_threshold": float(s.mid_term_elapsed_threshold),
        "consecutive_absent_days": s.consecutive_absent_days,
        "mon_fri_absent_count": s.mon_fri_absent_count,
        "chronic_absent_60d": s.chronic_absent_60d,
        "absence_rate_window_days": s.absence_rate_window_days,
        "absence_rate_delta": float(s.absence_rate_delta),
        "cat_drop_points": float(s.cat_drop_points),
        "burn_multiplier": float(s.burn_multiplier),
        "burn_window_days": s.burn_window_days,
        "digest_channel": s.digest_channel,
        "digest_limit": s.digest_limit,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def dec(val, default="0"):
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal(default)
