"""Run all early-warning scanners for a school."""
from __future__ import annotations


def scan_school(school) -> dict:
    from apps.risks.fee_scan import scan_fee_risks_for_school
    from apps.risks.attendance_scan import scan_attendance_risks_for_school
    from apps.risks.academic_scan import scan_academic_risks_for_school

    out = {"school_id": str(school.id)}
    try:
        out["fee"] = scan_fee_risks_for_school(school)
    except Exception as exc:
        out["fee"] = {"error": str(exc)}
    try:
        out["attendance"] = scan_attendance_risks_for_school(school)
    except Exception as exc:
        out["attendance"] = {"error": str(exc)}
    try:
        out["academic"] = scan_academic_risks_for_school(school)
    except Exception as e:
        out["academic"] = {"error": str(e)}
    return out


def scan_all_schools() -> list[dict]:
    from apps.school.models import School

    return [scan_school(s) for s in School.objects.all().iterator()]
