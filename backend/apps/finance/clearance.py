"""
Finance clearance: auto-match fee structure by grade/year/term and support extra fee lines.
"""
from decimal import Decimal
from django.db.models import Q, Sum
from django.utils import timezone


def _detect_year_term(school):
    """
    Resolve the school's "current" finance year/term.

    Priority:
      1. Academics module — active year + current (or date-matching) term  [source of truth]
      2. Most common term/year on invoices (billed activity)
      3. Most common term/year on payments (collected activity)
      4. Latest enrollment_term / enrollment_academic_year from admissions
      5. Fallback: calendar year + Term 1
    """
    # 1) Academic calendar (Phase A1 source of truth)
    try:
        from apps.academics.calendar import get_school_calendar
        cal = get_school_calendar(school)
        if cal.get("academic_year") is not None:
            return cal["year_label"], cal["term_label"]
    except Exception as exc:
        print(f"[finance] academics calendar: {exc}")

    year = str(timezone.now().year)
    term = "Term 1"

    def _norm_term(raw: str) -> str:
        s = (raw or "").strip()
        if not s:
            return ""
        low = s.lower().replace("_", " ")
        for n, label in ((1, "Term 1"), (2, "Term 2"), (3, "Term 3")):
            if f"term {n}" in low or low == f"t{n}" or low.startswith(f"t{n} "):
                return label
        return s

    try:
        from collections import Counter
        from apps.finance.models import Invoice, Payment
        school_id = getattr(school, "id", school)

        inv_terms = (
            Invoice.objects.filter(school_id=school_id)
            .exclude(term__isnull=True)
            .exclude(term="")
            .values_list("academic_year", "term")
        )
        c = Counter()
        for y, t in inv_terms:
            yl = (y or "").strip() or year
            tl = _norm_term(t)
            if tl:
                c[(yl, tl)] += 1
        if c:
            (year, term), _ = c.most_common(1)[0]
            return year, term

        pay_terms = (
            Payment.objects.filter(school_id=school_id)
            .exclude(term__isnull=True)
            .exclude(term="")
            .values_list("academic_year", "term")
        )
        c = Counter()
        for y, t in pay_terms:
            yl = (y or "").strip() or year
            tl = _norm_term(t)
            if tl:
                c[(yl, tl)] += 1
        if c:
            (year, term), _ = c.most_common(1)[0]
            return year, term
    except Exception as exc:
        print(f"[finance] detect from invoices/payments: {exc}")

    try:
        from apps.admissions.models import Application
        school_id = getattr(school, "id", school)
        app = (
            Application.objects.filter(school_id=school_id)
            .exclude(enrollment_term__isnull=True)
            .exclude(enrollment_term="")
            .order_by("-submitted_at")
            .first()
        )
        if app:
            if app.enrollment_academic_year:
                year = str(app.enrollment_academic_year).strip() or year
            if app.enrollment_term:
                term = _norm_term(app.enrollment_term) or term
            return year, term
    except Exception:
        pass

    return year, term



def _normalize_year_token(value):
    """Extract comparable year token from '2026', '2025/2026', '2025-26'."""
    s = str(value or "").strip()
    if not s:
        return ""
    import re as _re
    nums = _re.findall(r"20\d{2}", s)
    if nums:
        return nums[-1]
    nums = _re.findall(r"\d{2,4}", s)
    return nums[-1] if nums else s


def _normalize_term_token(value):
    s = str(value or "").strip().lower()
    if not s:
        return ""
    import re as _re
    m = _re.search(r"(\d+)", s)
    return m.group(1) if m else s


def term_match_q(field: str, selected_term: str):
    """Match invoice/payment term fields to a selected label (Term 3 / 3 / term3)."""
    from django.db.models import Q
    selected_term = (selected_term or "").strip()
    if not selected_term:
        return Q()
    tok = _normalize_term_token(selected_term)
    q = Q(**{f"{field}__iexact": selected_term})
    if tok:
        q |= Q(**{f"{field}__icontains": f"Term {tok}"})
        q |= Q(**{f"{field}__iexact": f"Term {tok}"})
        q |= Q(**{f"{field}__iexact": tok})
    return q


def resolve_student_grade(student):
    """Ensure student has current_class; fall back to application class_applied."""
    grade = getattr(student, "current_class", None)
    if grade is not None:
        return grade
    try:
        from apps.admissions.models import Application
        app = Application.objects.filter(student=student).select_related("class_applied").first()
        if app is None and getattr(student, "admission_number", None):
            app = (
                Application.objects.filter(
                    school_id=student.school_id,
                    admission_number=student.admission_number,
                )
                .select_related("class_applied")
                .first()
            )
        if app and app.class_applied_id:
            student.current_class_id = app.class_applied_id
            student.save(update_fields=["current_class"])
            return app.class_applied
    except Exception:
        pass
    return None


def fee_structure_matches(student, structure, academic_year=None, period_name=None):
    grade = resolve_student_grade(student)
    year_tok = _normalize_year_token(academic_year)
    term_tok = _normalize_term_token(period_name)
    return bool(
        grade
        and structure
        and structure.is_active
        and structure.school_id == student.school_id
        and structure.grade_level_id == grade.id
        and year_tok
        and term_tok
        and _normalize_year_token(structure.academic_year) == year_tok
        and _normalize_term_token(structure.period_name) == term_tok
    )


def find_fee_structure(student, academic_year=None, period_name=None):
    """
    Match an active FeeStructure for the student's grade + exact year + term.
    Never falls back to a different year/term (e.g. Term 1 2027 when Term 3 2026 was selected).
    """
    from .models import FeeStructure

    grade = resolve_student_grade(student)
    year_tok = _normalize_year_token(academic_year)
    term_tok = _normalize_term_token(period_name)
    if grade is None:
        return None
    if not year_tok or not term_tok:
        return None

    qs = FeeStructure.objects.filter(
        school_id=student.school_id,
        is_active=True,
    ).select_related("grade_level").prefetch_related("structure_items__item")

    exact = []
    for structure in qs:
        if getattr(structure, "grade_level_id", None) != getattr(grade, "id", None):
            # allow name match if ids differ across seeds
            gn = str(getattr(grade, "name", "") or "").strip().lower()
            sn = str(getattr(getattr(structure, "grade_level", None), "name", "") or "").strip().lower()
            if not gn or gn != sn:
                continue
        if _normalize_year_token(structure.academic_year) != year_tok:
            continue
        if _normalize_term_token(structure.period_name) != term_tok:
            continue
        exact.append(structure)

    if not exact:
        return None
    # Prefer structures that have line items
    exact.sort(key=lambda s: (0 if s.structure_items.exists() else 1, s.name or ""))
    return exact[0]


def list_structure_candidates(student, academic_year=None, period_name=None, limit=20):
    """Return active structures matching the student's exact grade/year/term."""
    from .models import FeeStructure

    grade = resolve_student_grade(student)
    year_tok = _normalize_year_token(academic_year)
    term_tok = _normalize_term_token(period_name)
    if grade is None or not year_tok or not term_tok:
        return []

    qs = FeeStructure.objects.filter(
        school_id=student.school_id,
        grade_level_id=grade.id,
        is_active=True,
    ).select_related("grade_level")
    out = []
    for s in qs:
        if (
            _normalize_year_token(s.academic_year) != year_tok
            or _normalize_term_token(s.period_name) != term_tok
        ):
            continue
        out.append({
            "id": str(s.id),
            "name": s.name,
            "academic_year": s.academic_year,
            "period_name": s.period_name,
            "grade": getattr(s.grade_level, "name", None),
            "is_active": s.is_active,
        })
    return out[:limit]


def ensure_student_billing(
student, user=None, academic_year=None, period_name=None):
    """
    Ensure StudentFeeAssignment + at least one Invoice with lines exist for clearance.
    Returns dict with structure, assignment, invoices, lines summary.
    """
    from .models import (
        StudentFeeAssignment,
        Invoice,
        InvoiceLine,
        Payment,
    )
    from .signals import create_invoice_lines_for_assignment

    # Enrollment selections are authoritative; do not infer a current/default period.
    if not academic_year or not period_name:
        from apps.admissions.models import Application
        app = (
            Application.objects.filter(student=student)
            .only("enrollment_term", "enrollment_academic_year", "admission_number")
            .first()
        )
        if app is None and getattr(student, "admission_number", None):
            app = (
                Application.objects.filter(
                    school_id=student.school_id,
                    admission_number=student.admission_number,
                )
                .only("enrollment_term", "enrollment_academic_year")
                .first()
            )
        if app:
            period_name = period_name or app.enrollment_term or None
            academic_year = academic_year or app.enrollment_academic_year or None

    # Backfill grade from application when missing
    resolve_student_grade(student)
    student.refresh_from_db()

    structure = None
    if student.fee_structure_id and academic_year and period_name:
        linked_structure = student.fee_structure
        if fee_structure_matches(student, linked_structure, academic_year, period_name):
            structure = linked_structure

    if structure is None:
        structure = find_fee_structure(student, academic_year, period_name)
    if structure and student.fee_structure_id != structure.id:
        student.fee_structure = structure
        student.save(update_fields=["fee_structure"])

    assignment = StudentFeeAssignment.objects.filter(student=student).first()
    if assignment is None and structure is not None:
        assignment = StudentFeeAssignment.objects.create(
            student=student,
            fee_structure=structure,
            assigned_by=user if getattr(user, "is_authenticated", False) else None,
        )
    elif assignment is not None and structure is not None and assignment.fee_structure_id != structure.id:
        # Repoint the existing assignment so its invoices remain connected and
        # payment history is preserved. The exact enrollment period is authoritative.
        assignment.fee_structure = structure
        assignment.save(update_fields=["fee_structure"])

    # Active lunch program → select Meals optional lines on this assignment
    if assignment is not None:
        try:
            from apps.finance.lunch import apply_lunch_enrollment_to_assignment
            apply_lunch_enrollment_to_assignment(assignment)
        except Exception:
            pass

    year = academic_year or (structure.academic_year if structure else None)
    term = period_name or (structure.period_name if structure else None)
    match_error = None
    if structure is None:
        gname = getattr(getattr(student, "current_class", None), "name", None) or "—"
        match_error = (
            f"No active fee structure for grade '{gname}' "
            f"(year={year or '—'}, term={term or '—'}). "
            "Create one under Finance → Fee structures for this grade/term."
        )

    invoices = []
    if structure:
        year_token = _normalize_year_token(academic_year)
        term_token = _normalize_term_token(period_name)
        invoices = [
            invoice
            for invoice in Invoice.objects.filter(student=student).order_by("due_date", "generated_at")
            if invoice.fee_assignment_id == getattr(assignment, "id", None)
            if _normalize_year_token(invoice.academic_year) == year_token
            and _normalize_term_token(invoice.term) == term_token
        ]
    if assignment and structure and not invoices:
        # Prefer retagging unpaid invoices (keeps cashier-added lines) over delete.
        stale_invoices = list(assignment.invoices.all().prefetch_related("payments", "lines"))
        retagged = []
        for stale in stale_invoices:
            if stale.payments.exists():
                continue
            stale.academic_year = str(year)[:9] if year else stale.academic_year
            stale.term = term or stale.term
            stale.fee_assignment = assignment
            stale.save(update_fields=["academic_year", "term", "fee_assignment"])
            retagged.append(stale)
        if retagged:
            invoices = retagged

    if not invoices and assignment and structure:
        # Mandatory only — optional items are added later at clearance if chosen
        total = getattr(structure, "mandatory_total", None)
        if total is None:
            total = structure.total_amount or Decimal("0")
        total = Decimal(str(total or 0))
        inv = Invoice.objects.create(
            student=student,
            fee_assignment=assignment,
            school=student.school,
            term=term,
            academic_year=str(year)[:9],
            amount_due=total,
            due_date=timezone.now().date(),
            generated_by=user if getattr(user, "is_authenticated", False) else None,
        )
        try:
            create_invoice_lines_for_assignment(inv, assignment, Decimal("1"))
            # Align invoice total to actual mandatory lines created
            line_sum = inv.lines.aggregate(t=Sum("amount"))["t"] or Decimal("0")
            if line_sum != inv.amount_due:
                inv.amount_due = line_sum
                inv.save(update_fields=["amount_due"])
        except Exception:
            for si in structure.structure_items.select_related("item").all():
                item = si.item
                if item is not None and getattr(item, "is_optional", False):
                    continue
                InvoiceLine.objects.create(
                    invoice=inv,
                    item=si.item,
                    description=getattr(si.item, "name", "Fee") or "Fee",
                    amount=si.amount,
                )
            line_sum = inv.lines.aggregate(t=Sum("amount"))["t"] or Decimal("0")
            inv.amount_due = line_sum
            inv.save(update_fields=["amount_due"])
        invoices = [inv]


    # Strip only STRUCTURE optional items not selected on the assignment.
    # Cashier "Add to bill" extras (Additional charges / non-structure items) must stay.
    if structure is not None and invoices:
        selected_opt = set()
        if assignment is not None:
            selected_opt = set(assignment.selected_optional_items.values_list("id", flat=True))
        optional_ids = set(structure.available_optional_items.values_list("id", flat=True))
        for inv in invoices:
            if inv.payments.exists():
                continue
            changed = False
            for ln in list(inv.lines.select_related("item", "item__category").all()):
                item = ln.item
                if item is None:
                    continue
                # Never strip Additional charges / non-structure fee items
                cat_name = (getattr(getattr(item, "category", None), "name", "") or "").lower()
                if "additional" in cat_name:
                    continue
                if item.id not in optional_ids:
                    continue
                if item.id not in selected_opt:
                    ln.delete()
                    changed = True
            if changed:
                recalculate_invoice_totals(inv)

    # If still no lines but structure exists, force rebuild mandatory-only invoice
    if structure is not None and assignment is not None:
        for inv in list(invoices):
            if inv.payments.exists():
                continue
            if inv.lines.exists():
                continue
            inv.delete()
            invoices = [i for i in invoices if i.id != inv.id]
        if not invoices:
            total = Decimal(str(getattr(structure, "mandatory_total", None) or 0))
            inv = Invoice.objects.create(
                student=student,
                fee_assignment=assignment,
                school=student.school,
                term=term,
                academic_year=str(year)[:9],
                amount_due=total,
                due_date=timezone.now().date(),
                generated_by=user if getattr(user, "is_authenticated", False) else None,
            )
            try:
                create_invoice_lines_for_assignment(inv, assignment, Decimal("1"))
                line_sum = inv.lines.aggregate(t=Sum("amount"))["t"] or Decimal("0")
                if line_sum != inv.amount_due:
                    inv.amount_due = line_sum
                    inv.save(update_fields=["amount_due"])
            except Exception:
                for si in structure.structure_items.select_related("item").all():
                    item = si.item
                    if item is None:
                        continue
                    if structure.is_item_optional(item):
                        continue
                    InvoiceLine.objects.create(
                        invoice=inv,
                        item=item,
                        description=getattr(item, "name", "Fee") or "Fee",
                        amount=si.amount,
                    )
                line_sum = inv.lines.aggregate(t=Sum("amount"))["t"] or Decimal("0")
                inv.amount_due = line_sum
                inv.save(update_fields=["amount_due"])
            invoices = [inv]


    # Build line preview
    lines = []
    for inv in invoices:
        for ln in inv.lines.select_related("item").all():
            orig = float(getattr(ln, "original_amount", None) or ln.amount or 0)
            waived = bool(getattr(ln, "is_waived", False))
            lines.append({
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "id": str(ln.id),
                "line_id": str(ln.id),
                "description": ln.description,
                "amount": float(0 if waived else (ln.amount or 0)),
                "original_amount": orig,
                "discount_amount": float(getattr(ln, "discount_amount", None) or 0),
                "is_waived": waived,
                "item_id": str(ln.item_id) if ln.item_id else None,
                "term": inv.term,
                "academic_year": inv.academic_year,
            })

    paid = (
        Payment.objects.filter(invoice__student=student)
        .exclude(payment_method="TRANSFER")
        .aggregate(t=Sum("amount"))["t"]
        or Decimal("0")
    )
    # Collectible due only (waived lines already amount=0 / is_waived excluded from amount_due)
    due = sum(
        (Decimal(str(i.amount_due or 0)) + Decimal(str(i.late_fee_applied or 0)) for i in invoices),
        Decimal("0"),
    )
    waived_total = Decimal("0")
    for inv in invoices:
        for ln in inv.lines.all():
            if getattr(ln, "is_waived", False):
                base = getattr(ln, "original_amount", None) or 0
                waived_total += Decimal(str(base or 0))

    return {
        "structure": {
            "id": str(structure.id),
            "name": structure.name,
            "academic_year": structure.academic_year,
            "period_name": structure.period_name,
            "total_amount": float(structure.total_amount or 0),
        } if structure else None,
        "assignment_id": str(assignment.id) if assignment else None,
        "invoices": [
            {
                "id": str(i.id),
                "invoice_number": i.invoice_number,
                "term": i.term,
                "academic_year": i.academic_year,
                "amount_due": float(i.amount_due or 0),
                "amount_paid": float(i.amount_paid or 0),
                "balance": float(getattr(i, "balance", 0) or max(0, float(i.amount_due or 0) - float(i.amount_paid or 0))),
            }
            for i in invoices
        ],
        "lines": lines,
        "total_due": float(due),
        "total_paid": float(paid),
        "waived_total": float(waived_total),
        "balance": float(max(Decimal("0"), due - paid)),
        "matched_year": str(year) if year else None,
        "matched_term": term,
        "error": match_error,
        "grade": getattr(getattr(student, "current_class", None), "name", None),
        "candidates": list_structure_candidates(student, year, term) if structure is None or match_error else [],
    }


def add_extra_fee_line(student, description, amount, user=None, fee_item_id=None):
    """
    Add a one-off fee line (uniform, assessment book, etc.) onto the student's open invoice.
    Creates invoice via ensure_student_billing if needed.
    """
    from .models import FeeItem, FeeCategory, Invoice, InvoiceLine

    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Amount must be positive")
    description = (description or "").strip()
    if not description:
        raise ValueError("Description is required")

    billing = ensure_student_billing(student, user=user)
    invoices = Invoice.objects.filter(student=student).order_by("due_date", "generated_at")
    inv = invoices.first()
    if not inv:
        raise ValueError("No invoice available — create a fee structure for this grade first")

    item = None
    if fee_item_id:
        item = FeeItem.objects.filter(pk=fee_item_id).first()
    if item is None:
        # Ensure a misc category + item for extras
        cat, _ = FeeCategory.objects.get_or_create(
            school=student.school,
            name="Additional charges",
            defaults={"is_mandatory": True, "display_order": 99},
        )
        item, _ = FeeItem.objects.get_or_create(
            category=cat,
            name=description[:100],
            # Not structure-optional — cashier extras must not be auto-stripped
            defaults={"is_optional": False, "description": description, "is_active": True},
        )
        # Repair legacy rows created as optional extras
        if getattr(item, "is_optional", False):
            item.is_optional = False
            item.save(update_fields=["is_optional"])

    line = InvoiceLine.objects.create(
        invoice=inv,
        item=item,
        description=description,
        amount=amount,
    )
    # Keep invoice totals in sync with all lines (including this extra)
    recalculate_invoice_totals(inv)
    inv.refresh_from_db()

    billing = ensure_student_billing(student, user=user)
    # Guarantee the new line is present even if billing rebuild races
    line_ids = {str(x.get("id")) for x in (billing.get("lines") or [])}
    if str(line.id) not in line_ids:
        billing.setdefault("lines", []).append({
            "id": str(line.id),
            "invoice_id": str(inv.id),
            "description": line.description or description,
            "amount": float(line.amount or amount),
            "original_amount": float(getattr(line, "original_amount", None) or line.amount or amount),
            "discount_amount": 0,
            "is_waived": False,
            "item_id": str(line.item_id) if line.item_id else None,
            "term": inv.term,
            "academic_year": inv.academic_year,
        })
        billing["total_due"] = float(
            Decimal(str(billing.get("total_due") or 0)) + Decimal(str(amount))
        )
        billing["balance"] = float(
            max(
                Decimal("0"),
                Decimal(str(billing.get("total_due") or 0))
                - Decimal(str(billing.get("total_paid") or 0)),
            )
        )
    return line, inv, billing



def recalculate_invoice_totals(invoice):
    """
    Collectible amount_due = sum of non-waived line amounts only.
    Waivers reduce what is owed but must NOT increase amount_paid (collections).
    Fully waived invoices (due=0) are settled with zero cash collected.
    """
    from decimal import Decimal
    from django.db.models import Sum, Q
    from .models import InvoiceLine

    lines = InvoiceLine.objects.filter(invoice=invoice)
    collectible = (
        lines.filter(is_waived=False).aggregate(s=Sum("amount"))["s"]
        or Decimal("0")
    )
    # Also treat amount=0 waived rows as excluded (amount already 0 when waived)
    collectible = Decimal(str(collectible))

    paid = Decimal(str(invoice.amount_paid or 0))
    late = Decimal(str(getattr(invoice, "late_fee_applied", 0) or 0))
    total_due = collectible + late

    invoice.amount_due = collectible
    invoice.balance = max(Decimal("0"), total_due - paid)
    # Settled if nothing left to collect (including all waived) OR cash covers due
    invoice.is_paid = total_due <= 0 or paid >= total_due
    if invoice.is_paid and total_due > 0 and not getattr(invoice, "paid_at", None):
        from django.utils import timezone
        invoice.paid_at = timezone.now()
    elif total_due <= 0:
        # Fully waived / zero bill — settled without treating as a cash payment event
        pass

    update_fields = ["amount_due", "balance", "is_paid"]
    if invoice.is_paid and getattr(invoice, "paid_at", None):
        update_fields.append("paid_at")
    invoice.save(update_fields=update_fields)
    return invoice


def adjust_invoice_line(line, *, waived=None, discount=None, reason=""):
    """
    Waive (amount→0) or discount a single invoice line for clearance/scholarships.
    """
    from decimal import Decimal

    base = line.billed_base()
    if line.original_amount is None:
        line.original_amount = base

    reason = (reason or "").strip()[:255]
    if waived is True:
        line.is_waived = True
        line.discount_amount = Decimal("0")
        line.amount = Decimal("0")
    elif waived is False:
        # restore full (clear waive)
        line.is_waived = False
        if discount is None:
            line.discount_amount = Decimal("0")
            line.amount = Decimal(str(line.original_amount or base))
        else:
            d = Decimal(str(discount))
            if d < 0:
                d = Decimal("0")
            if d > base:
                d = base
            line.discount_amount = d
            line.amount = max(Decimal("0"), base - d)
    elif discount is not None:
        d = Decimal(str(discount))
        if d < 0:
            d = Decimal("0")
        if d > base:
            d = base
        line.is_waived = False
        line.discount_amount = d
        line.amount = max(Decimal("0"), base - d)

    if reason:
        line.adjustment_reason = reason
    line.save()
    recalculate_invoice_totals(line.invoice)
    return line
