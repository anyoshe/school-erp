"""
R4 — Morning operational risk digest for school owners / admins.

Builds a short top-N alert summary and delivers via WhatsApp and/or email.
Default channel is LOG (safe for local); set env or pass channel= to send.
"""
from __future__ import annotations

import logging
import os
from datetime import date

from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


def _admin_contacts(school) -> dict:
    phone = (
        getattr(school, "phone", None)
        or getattr(school, "contact_phone", None)
        or getattr(school, "mobile", None)
        or ""
    )
    email = getattr(school, "email", None) or getattr(school, "contact_email", None) or ""
    owner = getattr(school, "owner", None)
    if owner is not None:
        email = email or getattr(owner, "email", "") or ""
        phone = phone or getattr(owner, "phone", "") or getattr(owner, "mobile", "") or ""
    return {"phone": str(phone or "").strip(), "email": str(email or "").strip()}


def build_digest_message(school, limit: int = 5) -> dict:
    from apps.risks.models import RiskAlert

    qs = list(
        RiskAlert.objects.filter(school=school, status=RiskAlert.Status.OPEN)
        .select_related("student")
        .order_by("severity", "-updated_at")[:50]
    )
    qs = sorted(qs, key=lambda a: SEVERITY_ORDER.get(a.severity, 9))[:limit]
    high = sum(1 for a in qs if a.severity == "HIGH")
    school_name = getattr(school, "name", "School")
    lines = [
        f"📋 {school_name} — morning risk brief",
        f"{len(qs)} priority item(s) · {high} high",
        "",
    ]
    if not qs:
        lines.append("No open risks. Good day to stay ahead.")
    else:
        for i, a in enumerate(qs, 1):
            cat = a.category
            lines.append(f"{i}. [{a.severity}/{cat}] {a.title}")
            if a.detail:
                lines.append(f"   {a.detail[:140]}")
        lines.append("")
        lines.append("Open the dashboard → Needs attention today.")
    text = "\n".join(lines)
    return {
        "message": text,
        "alert_count": len(qs),
        "high_count": high,
        "alerts": [
            {
                "id": str(a.id),
                "category": a.category,
                "severity": a.severity,
                "title": a.title,
            }
            for a in qs
        ],
    }


def send_digest(
    school,
    *,
    channel: str | None = None,
    limit: int = 5,
    force: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    channel: LOG | WHATSAPP | EMAIL | BOTH
    Defaults to env RISK_DIGEST_CHANNEL or LOG.
    """
    from apps.risks.models import RiskDigestLog

    today = timezone.localdate()
    if not channel:
        try:
            from apps.risks.settings_util import get_risk_settings
            channel = get_risk_settings(school).digest_channel
        except Exception:
            channel = None
    channel = (channel or os.getenv("RISK_DIGEST_CHANNEL") or "LOG").strip().upper()
    if channel not in ("LOG", "WHATSAPP", "EMAIL", "BOTH"):
        channel = "LOG"

    built = build_digest_message(school, limit=limit)
    contacts = _admin_contacts(school)
    results = {"whatsapp": None, "email": None}
    detail_parts = []

    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "channel": channel,
            "contacts": contacts,
            **built,
        }

    if not force and RiskDigestLog.objects.filter(
        school=school, digest_date=today, channel=channel
    ).exists():
        return {
            "ok": True,
            "skipped": True,
            "detail": "Digest already sent today for this channel",
            "channel": channel,
            **built,
        }

    msg = built["message"]

    if channel in ("WHATSAPP", "BOTH") and contacts["phone"]:
        try:
            from apps.attendance.whatsapp import send_whatsapp

            results["whatsapp"] = send_whatsapp(contacts["phone"], msg)
            detail_parts.append(f"wa:{results['whatsapp'].get('detail', '')[:80]}")
        except Exception as exc:
            results["whatsapp"] = {"ok": False, "detail": str(exc)}
            detail_parts.append(f"wa_err:{exc}")
    elif channel in ("WHATSAPP", "BOTH"):
        results["whatsapp"] = {"ok": False, "detail": "No school/owner phone"}
        detail_parts.append("wa:no_phone")

    if channel in ("EMAIL", "BOTH") and contacts["email"]:
        try:
            from_email = os.getenv("DEFAULT_FROM_EMAIL") or "noreply@school-erp.local"
            n = send_mail(
                subject=f"Morning risk brief — {getattr(school, 'name', 'School')}",
                message=msg,
                from_email=from_email,
                recipient_list=[contacts["email"]],
                fail_silently=True,
            )
            results["email"] = {"ok": bool(n), "detail": f"sent={n}"}
            detail_parts.append(f"email:sent={n}")
        except Exception as exc:
            results["email"] = {"ok": False, "detail": str(exc)}
            detail_parts.append(f"email_err:{exc}")
    elif channel in ("EMAIL", "BOTH"):
        results["email"] = {"ok": False, "detail": "No school/owner email"}
        detail_parts.append("email:no_address")

    if channel == "LOG":
        logger.info("[risk-digest:log] school=%s\n%s", school.id, msg[:500])
        detail_parts.append("logged")

    ok = True
    if channel == "WHATSAPP":
        ok = bool((results.get("whatsapp") or {}).get("ok"))
    elif channel == "EMAIL":
        ok = bool((results.get("email") or {}).get("ok"))
    elif channel == "BOTH":
        ok = bool((results.get("whatsapp") or {}).get("ok") or (results.get("email") or {}).get("ok"))

    log, _ = RiskDigestLog.objects.update_or_create(
        school=school,
        digest_date=today,
        channel=channel,
        defaults={
            "alert_count": built["alert_count"],
            "high_count": built["high_count"],
            "message_preview": msg[:2000],
            "payload": {"contacts": contacts, "results": results, "alerts": built["alerts"]},
            "ok": ok,
            "detail": "; ".join(detail_parts)[:500],
        },
    )
    return {
        "ok": ok,
        "digest_id": str(log.id),
        "channel": channel,
        "contacts": contacts,
        "results": results,
        **built,
    }
