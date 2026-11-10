from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school
from apps.risks.models import RiskAlert
from apps.risks.scan import scan_school


SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


class RiskTodayView(APIView):
    """Top open risks for the selected school (owner morning brief)."""

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

        def row(a: RiskAlert):
            st = a.student
            return {
                "id": str(a.id),
                "category": a.category,
                "severity": a.severity,
                "status": a.status,
                "title": a.title,
                "detail": a.detail,
                "metrics": a.metrics or {},
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
            }

        base = RiskAlert.objects.filter(school=school, status=RiskAlert.Status.OPEN)
        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "counts": {
                    "open": base.count(),
                    "fee": base.filter(category=RiskAlert.Category.FEE).count(),
                    "attendance": base.filter(category=RiskAlert.Category.ATTENDANCE).count(),
                    "academic": base.filter(category=RiskAlert.Category.ACADEMIC).count(),
                    "high": base.filter(severity=RiskAlert.Severity.HIGH).count(),
                },
                "alerts": [row(a) for a in items],
                "scan": scan_meta,
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
        return Response({"id": str(alert.id), "status": alert.status})


class RiskScanView(APIView):
    """Force full risk rescan (fee + attendance + academic) for current school."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        return Response(scan_school(school))
