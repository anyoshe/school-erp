"""
WhatsApp notifications for absence (and future alerts).

Configure via environment (backend/.env):

  WHATSAPP_PROVIDER=log|meta|ultramsg|twilio

  # Meta Cloud API
  WHATSAPP_TOKEN=EAAG...
  WHATSAPP_PHONE_NUMBER_ID=...

  # Ultramsg
  WHATSAPP_INSTANCE_ID=instanceXXXX
  WHATSAPP_TOKEN=...

  # Twilio
  TWILIO_ACCOUNT_SID=
  TWILIO_AUTH_TOKEN=
  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

Default provider is "log" (writes message, does not send) so local dev is safe.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)


def normalize_phone(raw: str, default_country: str = "254") -> Optional[str]:
    """Return digits-only international form without + (e.g. 2547xxxxxxxx)."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return None
    if digits.startswith("0") and len(digits) >= 9:
        digits = default_country + digits[1:]
    elif len(digits) == 9 and digits[0] in "17":
        digits = default_country + digits
    elif digits.startswith("254"):
        pass
    elif digits.startswith("1") and len(digits) == 11:
        pass
    return digits


def guardian_phone_for_student(student) -> Optional[str]:
    """Primary guardian phone, then any guardian, then emergency_phone."""
    try:
        link = (
            student.guardians.filter(is_active=True)
            .select_related("guardian")
            .order_by("-is_primary", "-is_emergency_contact")
            .first()
        )
        if link and link.guardian and link.guardian.phone:
            return normalize_phone(link.guardian.phone)
    except Exception as exc:
        logger.warning("guardian lookup: %s", exc)
    phone = getattr(student, "emergency_phone", None) or ""
    return normalize_phone(phone)


def absence_message(*, school_name: str, student_name: str, date_str: str, grade_name: str = "") -> str:
    grade_bit = f" ({grade_name})" if grade_name else ""
    return (
        f"Dear Parent/Guardian,\n\n"
        f"{student_name}{grade_bit} was marked ABSENT at {school_name} on {date_str}.\n\n"
        f"If this is unexpected, please contact the school.\n"
        f"— {school_name}"
    )


def send_whatsapp(phone: str, message: str) -> dict[str, Any]:
    """
    Send a WhatsApp text. Returns {ok, provider, detail, wa_link}.
    """
    provider = (os.getenv("WHATSAPP_PROVIDER") or "log").strip().lower()
    phone = normalize_phone(phone) or ""
    wa_link = f"https://wa.me/{phone}?text=" + requests.utils.quote(message) if phone else ""

    if not phone:
        return {"ok": False, "provider": provider, "detail": "No phone number", "wa_link": ""}

    try:
        if provider == "meta":
            return {**_send_meta(phone, message), "wa_link": wa_link}
        if provider == "ultramsg":
            return {**_send_ultramsg(phone, message), "wa_link": wa_link}
        if provider == "twilio":
            return {**_send_twilio(phone, message), "wa_link": wa_link}
        # log / unknown
        logger.info("[whatsapp:log] to=%s msg=%s", phone, message[:200])
        return {
            "ok": True,
            "provider": "log",
            "detail": "Logged only (set WHATSAPP_PROVIDER to meta|ultramsg|twilio to send)",
            "wa_link": wa_link,
        }
    except Exception as exc:
        logger.exception("whatsapp send failed")
        return {"ok": False, "provider": provider, "detail": str(exc), "wa_link": wa_link}


def _send_meta(phone: str, message: str) -> dict[str, Any]:
    token = os.getenv("WHATSAPP_TOKEN") or ""
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID") or ""
    if not token or not phone_id:
        return {"ok": False, "provider": "meta", "detail": "WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing"}
    url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": message},
    }
    r = requests.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=20,
    )
    ok = 200 <= r.status_code < 300
    return {"ok": ok, "provider": "meta", "detail": r.text[:500]}


def _send_ultramsg(phone: str, message: str) -> dict[str, Any]:
    instance = os.getenv("WHATSAPP_INSTANCE_ID") or ""
    token = os.getenv("WHATSAPP_TOKEN") or ""
    if not instance or not token:
        return {"ok": False, "provider": "ultramsg", "detail": "WHATSAPP_INSTANCE_ID / WHATSAPP_TOKEN missing"}
    url = f"https://api.ultramsg.com/{instance}/messages/chat"
    r = requests.post(
        url,
        data={"token": token, "to": phone, "body": message},
        timeout=20,
    )
    ok = 200 <= r.status_code < 300
    return {"ok": ok, "provider": "ultramsg", "detail": r.text[:500]}


def _send_twilio(phone: str, message: str) -> dict[str, Any]:
    sid = os.getenv("TWILIO_ACCOUNT_SID") or ""
    token = os.getenv("TWILIO_AUTH_TOKEN") or ""
    from_wa = os.getenv("TWILIO_WHATSAPP_FROM") or ""
    if not sid or not token or not from_wa:
        return {"ok": False, "provider": "twilio", "detail": "Twilio env vars missing"}
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    r = requests.post(
        url,
        data={
            "From": from_wa,
            "To": f"whatsapp:+{phone}",
            "Body": message,
        },
        auth=(sid, token),
        timeout=20,
    )
    ok = 200 <= r.status_code < 300
    return {"ok": ok, "provider": "twilio", "detail": r.text[:500]}


def notify_absence(student, *, school, date_str: str, grade_name: str = "") -> dict[str, Any]:
    phone = guardian_phone_for_student(student)
    name = f"{getattr(student, 'first_name', '') or ''} {getattr(student, 'last_name', '') or ''}".strip()
    school_name = getattr(school, "name", None) or "School"
    msg = absence_message(
        school_name=school_name,
        student_name=name or "Your child",
        date_str=date_str,
        grade_name=grade_name,
    )
    result = send_whatsapp(phone or "", msg)
    result["phone"] = phone
    result["student_id"] = str(student.id)
    result["message"] = msg
    return result
