from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school
from apps.risks.models import RiskAlert
from apps.risks.scan import scan_school
from apps.risks.digest import build_digest_message, send_digest
from apps.risks.settings_util import get_risk_settings, settings_as_dict


SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


def _serialize_alert(a: RiskAlert) -> dict:
    st = a.student
    return {
        "id": str(a.id),
        "category": a.category,
        "severity": a.severity,
        "status": a.status,
        "title": a.title,
        "detail": a.detail,
        "metrics": a.metrics or {},
        "fingerprint": a.fingerprint,
        "action_path": a.action_path
        or (
            f"/dashboard/modules/students/{st.id}"
            if st is not None
            else "/dashboard"
        ),
        "student": (
            {
                "id": str(st.id),
                "name": getattr(st, "full_name", None)
                or f"{st.first_name} {st.last_name}".strip(),
                "admission_number": getattr(st, "admission_number", "") or "",
            }
            if st
            else None
        ),
        "detected_at": a.detected_at,
        "updated_at": a.updated_at,
        "acknowledged_at": a.acknowledged_at,
        "resolved_at": a.resolved_at,
    }


class RiskTodayView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        refresh = request.query_params.get("refresh", "1") not in ("0", "false", "False")
        scan_meta = None
        if refresh:
            try:
                scan_meta = scan_school(school)
            except Exception as exc:
                scan_meta = {"error": str(exc)}

        limit = int(request.query_params.get("limit") or 12)
        category = (request.query_params.get("category") or "").upper().strip()
        qs = RiskAlert.objects.filter(school=school, status=RiskAlert.Status.OPEN)
        if category in ("FEE", "ATTENDANCE", "ACADEMIC", "OPS"):
            qs = qs.filter(category=category)
        qs = qs.select_related("student").order_by("severity", "-updated_at")[
            : max(1, min(limit, 50))
        ]
        items = sorted(qs, key=lambda a: SEVERITY_ORDER.get(a.severity, 9))
        base = RiskAlert.objects.filter(school=school, status=RiskAlert.Status.OPEN)
        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "counts": {
                    "open": base.count(),
                    "fee": base.filter(category=RiskAlert.Category.FEE).count(),
                    "attendance": base.filter(category=RiskAlert.Category.ATTENDANCE).count(),
                    "academic": base.filter(category=RiskAlert.Category.ACADEMIC).count(),
                    "ops": base.filter(category=RiskAlert.Category.OPS).count(),
                    "high": base.filter(severity=RiskAlert.Severity.HIGH).count(),
                },
                "alerts": [_serialize_alert(a) for a in items],
                "scan": scan_meta,
            }
        )


class RiskListView(APIView):
    """R6 — full control center list (open / acked / resolved)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        status = (request.query_params.get("status") or "OPEN").upper()
        category = (request.query_params.get("category") or "").upper().strip()
        severity = (request.query_params.get("severity") or "").upper().strip()
        limit = int(request.query_params.get("limit") or 100)

        qs = RiskAlert.objects.filter(school=school).select_related("student")
        if status and status != "ALL":
            qs = qs.filter(status=status)
        if category in ("FEE", "ATTENDANCE", "ACADEMIC", "OPS"):
            qs = qs.filter(category=category)
        if severity in ("HIGH", "MEDIUM", "LOW"):
            qs = qs.filter(severity=severity)
        qs = qs.order_by("-updated_at")[: max(1, min(limit, 300))]
        items = list(qs)
        # Keep HIGH first among same status pages when status=OPEN
        if status == "OPEN":
            items = sorted(items, key=lambda a: (SEVERITY_ORDER.get(a.severity, 9), -a.updated_at.timestamp()))

        counts = {
            "open": RiskAlert.objects.filter(school=school, status="OPEN").count(),
            "acknowledged": RiskAlert.objects.filter(school=school, status="ACKNOWLEDGED").count(),
            "resolved": RiskAlert.objects.filter(school=school, status="RESOLVED").count(),
        }
        return Response(
            {
                "counts": counts,
                "alerts": [_serialize_alert(a) for a in items],
            }
        )


class RiskAckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, alert_id):
        school = selected_school(request)
        alert = RiskAlert.objects.filter(pk=alert_id, school=school).first()
        if not alert:
            return Response({"detail": "Alert not found"}, status=404)
        alert.status = RiskAlert.Status.ACKNOWLEDGED
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user
        alert.save(
            update_fields=["status", "acknowledged_at", "acknowledged_by", "updated_at"]
        )
        return Response(_serialize_alert(alert))


class RiskResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, alert_id):
        school = selected_school(request)
        alert = RiskAlert.objects.filter(pk=alert_id, school=school).first()
        if not alert:
            return Response({"detail": "Alert not found"}, status=404)
        alert.status = RiskAlert.Status.RESOLVED
        alert.resolved_at = timezone.now()
        if not alert.acknowledged_at:
            alert.acknowledged_at = timezone.now()
            alert.acknowledged_by = request.user
        alert.save(
            update_fields=[
                "status",
                "resolved_at",
                "acknowledged_at",
                "acknowledged_by",
                "updated_at",
            ]
        )
        return Response(_serialize_alert(alert))


class RiskReopenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, alert_id):
        school = selected_school(request)
        alert = RiskAlert.objects.filter(pk=alert_id, school=school).first()
        if not alert:
            return Response({"detail": "Alert not found"}, status=404)
        alert.status = RiskAlert.Status.OPEN
        alert.resolved_at = None
        alert.save(update_fields=["status", "resolved_at", "updated_at"])
        return Response(_serialize_alert(alert))


class RiskScanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        return Response(scan_school(school))


class RiskDigestPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        cfg = get_risk_settings(school)
        limit = int(request.query_params.get("limit") or cfg.digest_limit or 5)
        if request.query_params.get("refresh", "1") not in ("0", "false"):
            try:
                scan_school(school)
            except Exception:
                pass
        built = build_digest_message(school, limit=limit)
        return Response(built)


class RiskDigestSendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        cfg = get_risk_settings(school)
        channel = request.data.get("channel") or cfg.digest_channel
        force = bool(request.data.get("force"))
        limit = int(request.data.get("limit") or cfg.digest_limit or 5)
        try:
            scan_school(school)
        except Exception:
            pass
        result = send_digest(school, channel=channel, limit=limit, force=force)
        return Response(result)


class RiskSettingsView(APIView):
    """R7 — get/update school risk thresholds."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        return Response(settings_as_dict(get_risk_settings(school)))

    def patch(self, request):
        school = selected_school(request)
        s = get_risk_settings(school)
        data = request.data or {}
        bool_fields = ("enable_fee", "enable_attendance", "enable_academic", "enable_ops")
        dec_fields = (
            "mid_term_collection_threshold",
            "mid_term_elapsed_threshold",
            "absence_rate_delta",
            "cat_drop_points",
            "burn_multiplier",
        )
        int_fields = (
            "consecutive_absent_days",
            "mon_fri_absent_count",
            "chronic_absent_60d",
            "absence_rate_window_days",
            "burn_window_days",
            "digest_limit",
        )
        for f in bool_fields:
            if f in data:
                setattr(s, f, bool(data[f]))
        for f in dec_fields:
            if f in data and data[f] is not None:
                from decimal import Decimal
                setattr(s, f, Decimal(str(data[f])))
        for f in int_fields:
            if f in data and data[f] is not None:
                setattr(s, f, int(data[f]))
        if "digest_channel" in data and data["digest_channel"]:
            ch = str(data["digest_channel"]).upper()
            if ch in ("LOG", "WHATSAPP", "EMAIL", "BOTH"):
                s.digest_channel = ch
        s.save()
        return Response(settings_as_dict(s))
