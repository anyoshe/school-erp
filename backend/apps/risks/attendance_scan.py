"""
R2 — Attendance / retention early-warning rules.

1. Consecutive absences (≥3 ABSENT in a row on recorded school days)
2. Mon/Fri pattern (≥3 absences on Monday or Friday in last 30 calendar days)
3. Rising absence rate (last 15 days rate ≥ prior 15 days rate + 15 points, with enough data)
4. Chronic term absences (≥7 ABSENT in last 60 days)
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from django.utils import timezone

from apps.risks.common import close_stale, student_name, upsert_alert

CONSECUTIVE_ABSENT = 3
MON_FRI_ABSENT = 3
CHRONIC_ABSENT_60D = 7
RATE_WINDOW = 15
RATE_DELTA = 0.15  # 15 percentage points


def scan_attendance_risks_for_school(school, today: date | None = None) -> dict:
    from apps.attendance.models import StudentAttendance
    from apps.risks.settings_util import get_risk_settings

    today = today or timezone.localdate()
    cfg = get_risk_settings(school)
    consecutive_need = int(cfg.consecutive_absent_days or CONSECUTIVE_ABSENT)
    mon_fri_need = int(cfg.mon_fri_absent_count or MON_FRI_ABSENT)
    chronic_need = int(cfg.chronic_absent_60d or CHRONIC_ABSENT_60D)
    rate_window = int(cfg.absence_rate_window_days or RATE_WINDOW)
    rate_delta = float(cfg.absence_rate_delta or RATE_DELTA)
    start_60 = today - timedelta(days=60)
    start_30 = today - timedelta(days=30)
    start_30_prior = today - timedelta(days=30 + rate_window)

    rows = list(
        StudentAttendance.objects.filter(
            school=school,
            date__gte=start_60,
            date__lte=today,
        )
        .select_related("student")
        .order_by("student_id", "date")
        .only("student_id", "date", "status", "student_id")
    )

    by_student: dict = defaultdict(list)
    for r in rows:
        by_student[str(r.student_id)].append(r)

    keep: set[str] = set()
    created_n = updated_n = 0

    for sid, records in by_student.items():
        student = records[0].student
        name = student_name(student)
        adm = getattr(student, "admission_number", "") or ""
        action = f"/dashboard/modules/students/{sid}"

        # sorted by date already
        absences = [r for r in records if r.status == "ABSENT"]
        if not absences:
            continue

        # 1) Consecutive ABSENT streak (most recent days with any record)
        streak = 0
        max_streak = 0
        # Walk from most recent record backwards through consecutive calendar... better:
        # consecutive ABSENT on successive *recorded* days ending at latest absence cluster
        for r in reversed(records):
            if r.status == "ABSENT":
                streak += 1
                max_streak = max(max_streak, streak)
            else:
                # break only if we already started counting from the end
                if streak > 0:
                    break
                streak = 0
        # Also compute any historical streak ≥ threshold in window
        run = 0
        any_streak = max_streak
        for r in records:
            if r.status == "ABSENT":
                run += 1
                any_streak = max(any_streak, run)
            else:
                run = 0

        if any_streak >= consecutive_need:
            fp = f"att:streak:{sid}"
            obj, created = upsert_alert(
                school=school,
                fingerprint=fp,
                category="ATTENDANCE",
                severity="HIGH" if any_streak >= 5 else "MEDIUM",
                title=f"{name}: {any_streak} consecutive absences",
                detail=(
                    f"{adm}: {any_streak}-day absent streak in the last 60 days. "
                    "Counselor follow-up before it becomes dropout risk."
                ),
                metrics={"streak": any_streak, "window_days": 60},
                student=student,
                action_path=action,
            )
            keep.add(fp)
            created_n += int(created)
            updated_n += int(not created)

        # 2) Mon/Fri pattern in last 30 days
        mon_fri = [
            r
            for r in absences
            if r.date >= start_30 and r.date.weekday() in (0, 4)  # Mon=0, Fri=4
        ]
        if len(mon_fri) >= mon_fri_need:
            fp = f"att:monfri:{sid}"
            obj, created = upsert_alert(
                school=school,
                fingerprint=fp,
                category="ATTENDANCE",
                severity="MEDIUM",
                title=f"{name}: Mon/Fri absence pattern",
                detail=(
                    f"{adm}: {len(mon_fri)} absences on Mondays/Fridays in the last 30 days. "
                    "Common early dropout signal — contact parent."
                ),
                metrics={"mon_fri_absences": len(mon_fri), "window_days": 30},
                student=student,
                action_path=action,
            )
            keep.add(fp)
            created_n += int(created)
            updated_n += int(not created)

        # 3) Rising rate: last 15d vs previous 15d
        recent = [r for r in records if r.date > today - timedelta(days=rate_window)]
        prior = [
            r
            for r in records
            if today - timedelta(days=2 * rate_window) < r.date <= today - timedelta(days=rate_window)
        ]
        if len(recent) >= 5 and len(prior) >= 5:
            r_abs = sum(1 for r in recent if r.status == "ABSENT") / len(recent)
            p_abs = sum(1 for r in prior if r.status == "ABSENT") / len(prior)
            if r_abs >= p_abs + rate_delta and r_abs >= 0.2:
                fp = f"att:rising:{sid}"
                obj, created = upsert_alert(
                    school=school,
                    fingerprint=fp,
                    category="ATTENDANCE",
                    severity="HIGH" if r_abs >= 0.4 else "MEDIUM",
                    title=f"{name}: absences rising sharply",
                    detail=(
                        f"{adm}: absence rate {r_abs*100:.0f}% (last {rate_window} days) vs "
                        f"{p_abs*100:.0f}% prior period (+{(r_abs-p_abs)*100:.0f} pts)."
                    ),
                    metrics={
                        "recent_rate": round(r_abs, 3),
                        "prior_rate": round(p_abs, 3),
                        "window": rate_window,
                    },
                    student=student,
                    action_path=action,
                )
                keep.add(fp)
                created_n += int(created)
                updated_n += int(not created)

        # 4) Chronic
        abs_60 = len(absences)
        if abs_60 >= chronic_need:
            fp = f"att:chronic:{sid}"
            obj, created = upsert_alert(
                school=school,
                fingerprint=fp,
                category="ATTENDANCE",
                severity="HIGH" if abs_60 >= 12 else "MEDIUM",
                title=f"{name}: {abs_60} absences in 60 days",
                detail=(
                    f"{adm}: chronic absenteeism ({abs_60} days). "
                    "Retention risk — schedule parent conference."
                ),
                metrics={"absences_60d": abs_60},
                student=student,
                action_path=action,
            )
            keep.add(fp)
            created_n += int(created)
            updated_n += int(not created)

    closed = close_stale(school, keep, category="ATTENDANCE")
    return {
        "school_id": str(school.id),
        "created": created_n,
        "updated": updated_n,
        "resolved_stale": closed,
        "open_fingerprints": len(keep),
    }
