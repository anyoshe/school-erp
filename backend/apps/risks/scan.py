"""Run all early-warning scanners for a school."""
from __future__ import annotations


def scan_school(school) -> dict:
    from apps.risks.fee_scan import scan_fee_risks_for_school
    from apps.risks.attendance_scan import scan_attendance_risks_for_school
    from apps.risks.academic_scan import scan_academic_risks_for_school
    from apps.risks.ops_scan import scan_ops_risks_for_school
    from apps.risks.settings_util import get_risk_settings

    cfg = get_risk_settings(school)
    out = {"school_id": str(school.id)}
    scanners = []
    if cfg.enable_fee:
        scanners.append(("fee", scan_fee_risks_for_school))
    else:
        out["fee"] = {"skipped": "disabled"}
    if cfg.enable_attendance:
        scanners.append(("attendance", scan_attendance_risks_for_school))
    else:
        out["attendance"] = {"skipped": "disabled"}
    if cfg.enable_academic:
        scanners.append(("academic", scan_academic_risks_for_school))
    else:
        out["academic"] = {"skipped": "disabled"}
    if cfg.enable_ops:
        scanners.append(("ops", scan_ops_risks_for_school))
    else:
        out["ops"] = {"skipped": "disabled"}

    for key, fn in scanners:
        try:
            out[key] = fn(school)
        except Exception as exc:
            out[key] = {"error": str(exc)}
    return out


def scan_all_schools() -> list[dict]:
    from apps.school.models import School

    return [scan_school(s) for s in School.objects.all().iterator()]
