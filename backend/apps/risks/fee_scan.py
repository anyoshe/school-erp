"""
R1 — Fee / revenue early-warning rules.

Rules (transparent, no ML):
1. Overdue — any invoice with balance > 0 and due_date < today
2. Missed consecutive promises — ≥2 overdue unpaid installments for same student (by due_date)
3. Mid-term lag — for current calendar term, paid/due < 40% once term is ≥40% elapsed
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Iterable

from django.db.models import Q, Sum
from django.utils import timezone


MID_TERM_COLLECTION_THRESHOLD = Decimal("0.40")
MID_TERM_ELAPSED_THRESHOLD = Decimal("0.40")


def _student_name(student) -> str:
    name = getattr(student, "full_name", None)
    if name:
        return str(name).strip()
    return f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip() or "Student"


def _upsert_alert(
    *,
    school,
    fingerprint: str,
    category: str,
    severity: str,
    title: str,
    detail: str,
    metrics: dict,
    student=None,
    action_path: str = "",
):
    from apps.risks.models import RiskAlert

    obj, created = RiskAlert.objects.update_or_create(
        school=school,
        fingerprint=fingerprint,
        defaults={
            "category": category,
            "severity": severity,
            "status": RiskAlert.Status.OPEN,
            "title": title[:200],
            "detail": detail,
            "metrics": metrics or {},
            "student": student,
            "action_path": action_path[:255] if action_path else "",
            "resolved_at": None,
        },
    )
    return obj, created


def _close_stale(school, keep_fingerprints: Iterable[str], category: str = "FEE"):
    """Resolve open fee alerts that no longer match active risk."""
    from apps.risks.models import RiskAlert

    qs = RiskAlert.objects.filter(
        school=school,
        category=category,
        status=RiskAlert.Status.OPEN,
    ).exclude(fingerprint__in=list(keep_fingerprints))
    return qs.update(status=RiskAlert.Status.RESOLVED, resolved_at=timezone.now())


def _current_term_window(school):
    """Return (term_name, year_label, start_date, end_date) or Nones."""
    try:
        from apps.academics.models import AcademicYear, Term
    except Exception:
        return None, None, None, None

    year = (
        AcademicYear.objects.filter(school=school, is_active=True)
        .order_by("-start_date")
        .first()
    )
    if not year:
        return None, None, None, None

    term = (
        Term.objects.filter(academic_year=year, is_current=True).first()
        or Term.objects.filter(academic_year=year).order_by("order", "start_date").first()
    )
    if not term:
        return None, str(year.name or year.start_date.year if year.start_date else ""), None, None

    return (
        str(term.name or ""),
        str(year.name or (year.start_date.year if year.start_date else "")),
        term.start_date,
        term.end_date,
    )


def scan_fee_risks_for_school(school, today: date | None = None) -> dict:
    from apps.finance.models import Invoice

    today = today or timezone.localdate()
    keep: set[str] = set()
    created_n = updated_n = 0

    # --- Rule 1 & 2: overdue invoices ---
    overdue = (
        Invoice.objects.filter(
            school=school,
            balance__gt=0,
            due_date__lt=today,
            is_paid=False,
        )
        .select_related("student")
        .order_by("student_id", "due_date")
    )

    by_student: dict = {}
    for inv in overdue:
        sid = str(inv.student_id)
        by_student.setdefault(sid, []).append(inv)

    for sid, invs in by_student.items():
        student = invs[0].student
        total_bal = sum(Decimal(str(i.balance or 0)) for i in invs)
        oldest = invs[0]
        days = (today - oldest.due_date).days if oldest.due_date else 0
        name = _student_name(student)
        adm = getattr(student, "admission_number", "") or ""

        # Consecutive missed promises: 2+ distinct overdue installments
        consecutive = len(invs) >= 2
        if consecutive:
            fp = f"fee:missed-promises:{sid}"
            severity = "HIGH"
            title = f"{name} missed {len(invs)} payment due dates"
            detail = (
                f"{adm}: {len(invs)} open invoices past due (oldest {days}d). "
                f"Balance KES {total_bal:,.0f}. Follow up before term-end pressure."
            )
            metrics = {
                "overdue_count": len(invs),
                "balance": float(total_bal),
                "oldest_days": days,
                "invoice_numbers": [i.invoice_number for i in invs[:5]],
            }
        else:
            fp = f"fee:overdue:{sid}"
            severity = "HIGH" if days >= 14 or total_bal >= 5000 else "MEDIUM"
            title = f"{name} fee overdue ({days}d)"
            detail = (
                f"{adm}: invoice {oldest.invoice_number} due {oldest.due_date}, "
                f"balance KES {total_bal:,.0f}."
            )
            metrics = {
                "overdue_count": 1,
                "balance": float(total_bal),
                "oldest_days": days,
                "invoice_number": oldest.invoice_number,
            }

        action = f"/dashboard/modules/students/{sid}"
        obj, created = _upsert_alert(
            school=school,
            fingerprint=fp,
            category="FEE",
            severity=severity,
            title=title,
            detail=detail,
            metrics=metrics,
            student=student,
            action_path=action,
        )
        keep.add(fp)
        if created:
            created_n += 1
        else:
            updated_n += 1

    # --- Rule 3: mid-term collection lag ---
    term_name, year_label, start, end = _current_term_window(school)
    if start and end and end > start:
        elapsed = Decimal(str((today - start).days)) / Decimal(str((end - start).days or 1))
        if elapsed >= MID_TERM_ELAPSED_THRESHOLD:
            # Aggregate per student for this term/year labels (fuzzy match on term string)
            term_q = Q()
            if term_name:
                term_q |= Q(term__icontains=term_name.replace("Term ", "").strip())
                term_q |= Q(term__icontains=term_name)
            if year_label:
                # also accept year-only filter
                pass

            inv_qs = Invoice.objects.filter(school=school).filter(
                Q(academic_year__icontains=str(year_label)[:4]) if year_label else Q()
            )
            if term_name:
                inv_qs = inv_qs.filter(
                    Q(term__icontains=term_name)
                    | Q(term__icontains=term_name.replace("Term ", "T"))
                    | Q(term__icontains=term_name.split()[-1] if term_name.split() else term_name)
                )

            # Group by student
            rows = (
                inv_qs.values("student_id")
                .annotate(
                    due=Sum("amount_due"),
                    paid=Sum("amount_paid"),
                )
            )
            from apps.students.models import Student

            student_map = {
                str(s.id): s
                for s in Student.objects.filter(
                    school=school,
                    id__in=[r["student_id"] for r in rows if r["student_id"]],
                )
            }
            for r in rows:
                due = Decimal(str(r["due"] or 0))
                paid = Decimal(str(r["paid"] or 0))
                if due <= 0:
                    continue
                ratio = paid / due
                if ratio >= MID_TERM_COLLECTION_THRESHOLD:
                    continue
                sid = str(r["student_id"])
                student = student_map.get(sid)
                if not student:
                    continue
                # Skip if already fully covered by stronger overdue alert only? keep both is OK
                fp = f"fee:midterm-lag:{sid}"
                name = _student_name(student)
                pct = float(ratio * 100)
                obj, created = _upsert_alert(
                    school=school,
                    fingerprint=fp,
                    category="FEE",
                    severity="MEDIUM" if pct >= 20 else "HIGH",
                    title=f"{name} only {pct:.0f}% fees collected mid-term",
                    detail=(
                        f"{getattr(student, 'admission_number', '') or ''}: "
                        f"paid KES {paid:,.0f} of {due:,.0f} for {term_name or 'current term'} "
                        f"({year_label}). Term ~{float(elapsed)*100:.0f}% elapsed — "
                        f"nudge payment plan before term-end."
                    ),
                    metrics={
                        "paid": float(paid),
                        "due": float(due),
                        "ratio": float(ratio),
                        "term": term_name,
                        "year": year_label,
                        "elapsed": float(elapsed),
                    },
                    student=student,
                    action_path=f"/dashboard/modules/students/{sid}",
                )
                keep.add(fp)
                if created:
                    created_n += 1
                else:
                    updated_n += 1

    closed = _close_stale(school, keep, category="FEE")
    return {
        "school_id": str(school.id),
        "created": created_n,
        "updated": updated_n,
        "resolved_stale": closed,
        "open_fingerprints": len(keep),
    }


def scan_all_schools() -> list[dict]:
    from apps.school.models import School

    out = []
    for school in School.objects.all().iterator():
        out.append(scan_fee_risks_for_school(school))
    return out
