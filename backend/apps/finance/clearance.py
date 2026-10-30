"""
Finance clearance: auto-match fee structure by grade/year/term and support extra fee lines.
"""
from decimal import Decimal
from django.db.models import Q, Sum
from django.utils import timezone


def _detect_year_term(school):
    year = str(timezone.now().year)
    term = "Term 1"
    try:
        from apps.academics.models import AcademicYear, Term
        from django.db.models import Q
        ay = (
            AcademicYear.objects.filter(Q(school=school) | Q(school_id=school.id), is_active=True).first()
            or AcademicYear.objects.filter(Q(school=school) | Q(school_id=school.id)).order_by("-start_date").first()
        )
        if ay:
            year = getattr(ay, "name", None) or str(getattr(ay, "start_date", "") or year)[:9]
            year = str(year)[:9]
            today = timezone.now().date()
            t = (
                Term.objects.filter(academic_year=ay, start_date__lte=today, end_date__gte=today).first()
                or Term.objects.filter(academic_year=ay).order_by("order", "start_date").first()
            )
            if t:
                term = t.name or term
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
        # A legacy assignment can have invoices for the wrong year/term. If it
        # has no payments, retag and regenerate those invoices from the exact
        # enrollment structure. Paid invoices retain their historical period.
        stale_invoices = list(assignment.invoices.all().prefetch_related("payments"))
        if stale_invoices and all(not invoice.payments.exists() for invoice in stale_invoices):
            for stale in stale_invoices:
                stale.delete()

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


    # Strip optional lines from unpaid invoices (optionals only via "Add to bill")
    if structure is not None and invoices:
        selected_opt = set()
        if assignment is not None:
            selected_opt = set(assignment.selected_optional_items.values_list("id", flat=True))
        optional_ids = set(structure.available_optional_items.values_list("id", flat=True))
        for inv in invoices:
            if inv.payments.exists():
                continue
            changed = False
            for ln in list(inv.lines.select_related("item").all()):
                item = ln.item
                if item is None:
                    continue
                is_opt = bool(getattr(item, "is_optional", False)) or (item.id in optional_ids)
                if is_opt and item.id not in selected_opt:
                    ln.delete()
                    changed = True
            if changed:
                line_sum = inv.lines.aggregate(t=Sum("amount"))["t"] or Decimal("0")
                inv.amount_due = line_sum
                inv.amount_paid = inv.amount_paid or Decimal("0")
                inv.balance = max(Decimal("0"), line_sum - Decimal(str(inv.amount_paid or 0)))
                inv.save(update_fields=["amount_due", "balance"])

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
            lines.append({
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "id": str(ln.id),
                "line_id": str(ln.id),
                "description": ln.description,
                "amount": float(ln.amount or 0),
                "original_amount": float(getattr(ln, "original_amount", None) or ln.amount or 0),
                "discount_amount": float(getattr(ln, "discount_amount", None) or 0),
                "is_waived": bool(getattr(ln, "is_waived", False)),
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
    due = sum(
        (Decimal(str(i.amount_due or 0)) + Decimal(str(i.late_fee_applied or 0)) for i in invoices),
        Decimal("0"),
    )

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
            defaults={"is_optional": True, "description": description},
        )

    line = InvoiceLine.objects.create(
        invoice=inv,
        item=item,
        description=description,
        amount=amount,
    )
    inv.amount_due = Decimal(str(inv.amount_due or 0)) + amount
    inv.save()  # refreshes balance

    return line, inv, ensure_student_billing(student, user=user)



def recalculate_invoice_totals(invoice):
    """Set amount_due from sum of line amounts; preserve amount_paid."""
    from decimal import Decimal
    from django.db.models import Sum
    from .models import InvoiceLine

    total = (
        InvoiceLine.objects.filter(invoice=invoice).aggregate(s=Sum("amount"))["s"]
        or Decimal("0")
    )
    invoice.amount_due = Decimal(str(total))
    paid = Decimal(str(invoice.amount_paid or 0))
    invoice.is_paid = paid >= Decimal(str(total)) and Decimal(str(total)) > 0
    invoice.save(update_fields=["amount_due", "is_paid"])
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
    elif waived is False and discount is None:
        # restore full
        line.is_waived = False
        line.discount_amount = Decimal("0")
        line.amount = Decimal(str(line.original_amount))
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
