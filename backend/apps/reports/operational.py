"""Operational report snapshots for the Reports hub (JSON + CSV)."""
import csv
import io
from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school


def _csv_response(filename: str, headers: list, rows: list) -> HttpResponse:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for row in rows:
        w.writerow(row)
    resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


class OperationalSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        from apps.students.models import Student
        from apps.admissions.models import Application
        from apps.finance.models import Invoice

        students = Student.objects.filter(school=school)
        active = students.exclude(status__in=["WITHDRAWN", "TRANSFERRED", "GRADUATED"]).count()
        apps = Application.objects.filter(school=school)
        by_status = {}
        for st, _ in Application.Status.choices:
            by_status[st] = apps.filter(status=st).count()

        open_inv = Invoice.objects.filter(school=school).exclude(
            status__in=["PAID", "CANCELLED", "WAIVED"]
        )
        try:
            arrears_count = open_inv.count()
            from django.db.models import Sum, F
            # balance field varies — try common names
            arrears_amount = 0
            for inv in open_inv[:500]:
                bal = getattr(inv, "balance", None)
                if bal is None:
                    total = getattr(inv, "total_amount", None) or getattr(inv, "amount", 0) or 0
                    paid = getattr(inv, "amount_paid", None) or getattr(inv, "paid_amount", 0) or 0
                    bal = float(total) - float(paid)
                arrears_amount += float(bal or 0)
        except Exception:
            arrears_count = 0
            arrears_amount = 0

        return Response(
            {
                "students_active": active,
                "students_total": students.count(),
                "applications_by_status": by_status,
                "open_invoices": arrears_count,
                "estimated_arrears": round(arrears_amount, 2),
            }
        )


class EnrollmentFunnelCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        from apps.admissions.models import Application

        rows = []
        for app in Application.objects.filter(school=school).order_by("-created_at")[:2000]:
            rows.append(
                [
                    app.id,
                    app.status,
                    app.first_name,
                    app.last_name,
                    getattr(app.class_applied, "name", "") if app.class_applied_id else "",
                    app.primary_guardian_phone or "",
                    app.created_at.date().isoformat() if app.created_at else "",
                    app.offer_issued_at.date().isoformat() if app.offer_issued_at else "",
                ]
            )
        return _csv_response(
            "enrollment_funnel.csv",
            [
                "id",
                "status",
                "first_name",
                "last_name",
                "class",
                "guardian_phone",
                "created",
                "offer_issued",
            ],
            rows,
        )


class ArrearsCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        from apps.finance.models import Invoice

        qs = (
            Invoice.objects.filter(school=school)
            .exclude(status__in=["PAID", "CANCELLED", "WAIVED"])
            .select_related("student")
            .order_by("-id")[:3000]
        )
        rows = []
        for inv in qs:
            st = inv.student
            total = getattr(inv, "total_amount", None) or getattr(inv, "amount", 0) or 0
            paid = getattr(inv, "amount_paid", None) or getattr(inv, "paid_amount", 0) or 0
            bal = getattr(inv, "balance", None)
            if bal is None:
                bal = float(total) - float(paid)
            rows.append(
                [
                    inv.id,
                    getattr(inv, "number", "") or getattr(inv, "invoice_number", "") or inv.id,
                    inv.status,
                    st.admission_number if st else "",
                    f"{getattr(st, 'first_name', '')} {getattr(st, 'last_name', '')}".strip() if st else "",
                    total,
                    paid,
                    bal,
                ]
            )
        return _csv_response(
            "fee_arrears.csv",
            [
                "invoice_id",
                "number",
                "status",
                "admission_number",
                "student",
                "total",
                "paid",
                "balance",
            ],
            rows,
        )


class AttendanceSummaryCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        days = int(request.query_params.get("days") or 30)
        since = timezone.now().date() - timedelta(days=days)
        try:
            from apps.attendance.models import AttendanceRecord
        except Exception:
            try:
                from apps.attendance.models import Attendance as AttendanceRecord
            except Exception:
                return _csv_response("attendance_summary.csv", ["detail"], [["No attendance model"]])

        # Best-effort field names
        qs = AttendanceRecord.objects.filter(school=school)
        date_field = "date" if hasattr(AttendanceRecord, "date") else None
        if date_field:
            qs = qs.filter(date__gte=since)
        status_field = "status" if hasattr(AttendanceRecord, "status") else None
        rows = []
        if status_field:
            from django.db.models import Count

            grouped = qs.values(status_field).annotate(c=Count("id")).order_by()
            for g in grouped:
                rows.append([g.get(status_field), g.get("c"), days])
        else:
            rows.append([qs.count(), days])
        return _csv_response(
            "attendance_summary.csv",
            ["status", "count", "window_days"] if status_field else ["count", "window_days"],
            rows,
        )
