"""Outbound notifications — LOG by default; SMS when credentials exist."""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def send_sms(phone: str, message: str, *, school=None) -> dict:
    """
    Send SMS if AFRICASTALKING_USERNAME + AFRICASTALKING_API_KEY are set.
    Otherwise log only (safe default for local / unconfigured deploys).
    """
    phone = (phone or "").strip()
    message = (message or "").strip()
    if not phone or not message:
        return {"ok": False, "reason": "missing_phone_or_message"}

    user = os.environ.get("AFRICASTALKING_USERNAME") or os.environ.get("AT_USERNAME")
    key = os.environ.get("AFRICASTALKING_API_KEY") or os.environ.get("AT_API_KEY")
    sender = os.environ.get("AFRICASTALKING_SENDER_ID") or os.environ.get("AT_SENDER_ID") or "GETAXE"

    if not user or not key:
        logger.info(
            "[notify:sms:skip] school=%s to=%s msg=%s",
            getattr(school, "id", None),
            phone,
            message[:120],
        )
        return {"ok": False, "reason": "not_configured", "logged": True}

    try:
        import africastalking  # optional dependency

        africastalking.initialize(user, key)
        sms = africastalking.SMS
        res = sms.send(message, [phone], sender)
        logger.info("[notify:sms:sent] to=%s res=%s", phone, res)
        return {"ok": True, "provider": "africastalking", "result": res}
    except Exception as e:
        logger.exception("[notify:sms:error] to=%s err=%s", phone, e)
        return {"ok": False, "reason": str(e)}


def notify_absence(school, student, *, date_str: str = "") -> dict:
    """Best-effort parent SMS when a learner is marked absent."""
    phone = None
    try:
        # Primary guardian phone on student if present
        phone = (
            getattr(student, "primary_guardian_phone", None)
            or getattr(student, "guardian_phone", None)
            or getattr(student, "emergency_contact_phone", None)
        )
        if not phone and hasattr(student, "guardians"):
            g = student.guardians.first()
            phone = getattr(g, "phone", None) if g else None
    except Exception:
        phone = None
    name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
    school_name = getattr(school, "name", None) or "School"
    msg = f"{school_name}: {name or 'Your child'} was marked absent"
    if date_str:
        msg += f" on {date_str}"
    msg += ". Please contact the school if this is unexpected."
    return send_sms(phone or "", msg, school=school)
