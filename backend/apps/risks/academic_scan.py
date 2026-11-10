"""
R3 — Academic trajectory early-warning rules (CAT / continuous assessments).

1. Downward CAT curve on a subject (≥2 points, strictly declining % scores)
2. Multi-subject decline (≥2 subjects with downward curve in current term/year)
3. Latest CAT well below prior average (≥15 points drop)
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db.models import Q

from apps.risks.common import close_stale, student_name, upsert_alert

DROP_POINTS = Decimal("15")


def _pct(score, max_score) -> Decimal | None:
    if score is None:
        return None
    try:
        s = Decimal(str(score))
        m = Decimal(str(max_score or 100))
    except Exception:
        return None
    if m <= 0:
        return None
    return (s / m) * Decimal("100")


def _cat_order_key(assessment) -> tuple:
    """Order CATs by name number then date."""
    name = (assessment.name or "").upper()
    n = 99
    for i in range(1, 6):
        if f"CAT {i}" in name or f"CAT{i}" in name or f"C.A.T {i}" in name:
            n = i
            break
    if assessment.kind == "END_TERM":
        n = 50
    if assessment.assessment_date:
        d = assessment.assessment_date
    elif getattr(assessment, 'created_at', None):
        d = assessment.created_at.date()
    else:
        d = None
    return (n, d or __import__("datetime").date.min)


def scan_academic_risks_for_school(school) -> dict:
    from apps.academics.models import AcademicYear, Term
    from apps.assessments.models import Assessment, Mark
    from apps.risks.settings_util import get_risk_settings

    cfg = get_risk_settings(school)
    drop_points = Decimal(str(cfg.cat_drop_points or DROP_POINTS))

    year = (
        AcademicYear.objects.filter(school=school, is_active=True)
        .order_by("-start_date")
        .first()
    )
    if not year:
        return {"school_id": str(school.id), "created": 0, "updated": 0, "resolved_stale": 0, "skipped": "no_active_year"}

    term = (
        Term.objects.filter(academic_year=year, is_current=True).first()
        or Term.objects.filter(academic_year=year).order_by("order", "start_date").first()
    )

    assessments = list(
        Assessment.objects.filter(school=school, academic_year=year)
        .filter(Q(kind="CAT") | Q(name__icontains="CAT"))
        .select_related("subject", "term")
    )
    if term:
        # Prefer current term CATs; fall back to all year if too few
        term_assessments = [a for a in assessments if a.term_id == term.id]
        if len(term_assessments) >= 1:
            assessments = term_assessments

    if not assessments:
        closed = close_stale(school, [], category="ACADEMIC")
        return {
            "school_id": str(school.id),
            "created": 0,
            "updated": 0,
            "resolved_stale": closed,
            "skipped": "no_cat_assessments",
        }

    a_ids = [a.id for a in assessments]
    a_map = {str(a.id): a for a in assessments}

    marks = (
        Mark.objects.filter(school=school, assessment_id__in=a_ids, is_absent=False)
        .exclude(score__isnull=True)
        .select_related("student", "assessment", "assessment__subject")
    )

    # student -> subject -> [(order, pct, assessment_name)]
    series: dict = defaultdict(lambda: defaultdict(list))
    student_obj = {}
    for m in marks:
        a = m.assessment
        pct = _pct(m.score, a.max_score)
        if pct is None:
            continue
        sid = str(m.student_id)
        student_obj[sid] = m.student
        subj = str(a.subject_id)
        series[sid][subj].append((_cat_order_key(a), pct, a.name, getattr(a.subject, "name", "Subject")))

    keep: set[str] = set()
    created_n = updated_n = 0

    for sid, by_subj in series.items():
        student = student_obj.get(sid)
        if not student:
            continue
        name = student_name(student)
        adm = getattr(student, "admission_number", "") or ""
        action = f"/dashboard/modules/academics"  # markbook lives under academics
        declining_subjects = []

        for subj_id, points in by_subj.items():
            points_sorted = sorted(points, key=lambda x: x[0])
            if len(points_sorted) < 2:
                continue
            pcts = [p[1] for p in points_sorted]
            # Strictly declining across available points
            declining = all(pcts[i] > pcts[i + 1] for i in range(len(pcts) - 1))
            # Or last vs first drop ≥ 15
            big_drop = pcts[-1] <= pcts[0] - drop_points
            if not (declining or big_drop):
                continue
            subj_name = points_sorted[0][3]
            declining_subjects.append(
                {
                    "subject": subj_name,
                    "scores": [float(p) for p in pcts],
                    "labels": [p[2] for p in points_sorted],
                }
            )

            fp = f"acad:down:{sid}:{subj_id}"
            trail = " → ".join(f"{float(p):.0f}%" for p in pcts)
            obj, created = upsert_alert(
                school=school,
                fingerprint=fp,
                category="ACADEMIC",
                severity="HIGH" if (pcts[-1] < 40 or big_drop) else "MEDIUM",
                title=f"{name}: {subj_name} scores declining",
                detail=(
                    f"{adm}: {subj_name} CAT trajectory {trail}. "
                    "Recommend remediation before end-of-term exams."
                ),
                metrics={
                    "subject": subj_name,
                    "percentages": [float(p) for p in pcts],
                    "assessments": [p[2] for p in points_sorted],
                },
                student=student,
                action_path=action,
            )
            keep.add(fp)
            created_n += int(created)
            updated_n += int(not created)

        if len(declining_subjects) >= 2:
            fp = f"acad:multi:{sid}"
            sub_names = ", ".join(d["subject"] for d in declining_subjects[:4])
            obj, created = upsert_alert(
                school=school,
                fingerprint=fp,
                category="ACADEMIC",
                severity="HIGH",
                title=f"{name}: declining in {len(declining_subjects)} subjects",
                detail=(
                    f"{adm}: downward CAT curves in {sub_names}. "
                    "Priority for learning support / parent meeting."
                ),
                metrics={"subjects": declining_subjects},
                student=student,
                action_path=action,
            )
            keep.add(fp)
            created_n += int(created)
            updated_n += int(not created)

    closed = close_stale(school, keep, category="ACADEMIC")
    return {
        "school_id": str(school.id),
        "created": created_n,
        "updated": updated_n,
        "resolved_stale": closed,
        "open_fingerprints": len(keep),
    }
