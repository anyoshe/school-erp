"""Library domain services — issue / return / copy registration (transactional)."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Book, BookCopy, Borrowing, LibrarySettings


def get_or_create_settings(school):
    obj, _ = LibrarySettings.objects.get_or_create(school=school)
    return obj


@transaction.atomic
def register_copies(
    *,
    school,
    book: Book,
    count: int,
    accession_prefix: str = "",
    start_number: int | None = None,
    storage_location: str = "",
    acquisition_source: str = "",
    acquisition_date=None,
    purchase_price=None,
) -> list[BookCopy]:
    if count < 1 or count > 500:
        raise ValidationError("Copy count must be between 1 and 500.")
    existing = (
        BookCopy.objects.filter(school=school, accession_number__startswith=accession_prefix or "ACC")
        .count()
    )
    base = start_number if start_number is not None else existing + 1
    prefix = accession_prefix or "ACC"
    created = []
    for i in range(count):
        num = f"{prefix}-{base + i:04d}"
        while BookCopy.objects.filter(school=school, accession_number=num).exists():
            base += 1
            num = f"{prefix}-{base + i:04d}"
        copy = BookCopy.objects.create(
            school=school,
            book=book,
            accession_number=num,
            storage_location=storage_location or "",
            acquisition_source=acquisition_source or "",
            acquisition_date=acquisition_date,
            purchase_price=purchase_price,
            status=BookCopy.Status.AVAILABLE,
        )
        created.append(copy)
    Book.objects.filter(pk=book.pk).update(quantity=book.copies.count())
    return created


@transaction.atomic
def issue_copy(
    *,
    school,
    copy: BookCopy,
    borrow_date: date | None = None,
    due_date: date | None = None,
    student=None,
    staff=None,
    user=None,
    issued_by=None,
    academic_year: str = "",
    term: str = "",
    remarks: str = "",
    is_allocation_loan: bool = False,
) -> Borrowing:
    if copy.school_id != school.id:
        raise ValidationError("Copy does not belong to this school.")
    copy = BookCopy.objects.select_for_update().get(pk=copy.pk)
    if copy.status != BookCopy.Status.AVAILABLE:
        raise ValidationError(f"Copy is not available (status={copy.status}).")
    settings = get_or_create_settings(school)
    borrow_date = borrow_date or timezone.localdate()
    if student:
        active = Borrowing.objects.filter(
            school=school, student=student, status=Borrowing.Status.ACTIVE
        ).count()
        if active >= settings.max_active_loans_student:
            raise ValidationError("Student has reached the maximum active loans.")
        borrower_type = Borrowing.BorrowerType.STUDENT
        days = settings.student_loan_days
    elif staff:
        active = Borrowing.objects.filter(
            school=school, staff=staff, status=Borrowing.Status.ACTIVE
        ).count()
        if active >= settings.max_active_loans_staff:
            raise ValidationError("Staff member has reached the maximum active loans.")
        borrower_type = Borrowing.BorrowerType.STAFF
        days = settings.staff_loan_days
    elif user:
        borrower_type = Borrowing.BorrowerType.USER
        days = settings.student_loan_days
    else:
        raise ValidationError("Provide student, staff, or user as borrower.")

    if due_date is None:
        due_date = borrow_date + timedelta(days=days)

    loan = Borrowing.objects.create(
        school=school,
        book=copy.book,
        copy=copy,
        student=student,
        staff=staff,
        user=user,
        borrower_type=borrower_type,
        borrow_date=borrow_date,
        due_date=due_date,
        status=Borrowing.Status.ACTIVE,
        issued_by=issued_by,
        academic_year=academic_year or "",
        term=term or "",
        remarks=remarks or "",
        is_allocation_loan=is_allocation_loan,
    )
    copy.status = BookCopy.Status.ISSUED
    copy.save(update_fields=["status"])
    try:
        from .notifications import notify_loan_issued
        notify_loan_issued(loan)
    except Exception:
        pass
    return loan


@transaction.atomic
def return_loan(
    *,
    loan: Borrowing,
    return_date: date | None = None,
    condition: str = "",
    returned_to=None,
    mark_lost: bool = False,
    mark_damaged: bool = False,
    remarks: str = "",
    is_allocation_loan: bool = False,
) -> Borrowing:
    loan = Borrowing.objects.select_for_update().select_related("copy").get(pk=loan.pk)
    if loan.status == Borrowing.Status.RETURNED:
        raise ValidationError("Loan already returned.")
    return_date = return_date or timezone.localdate()
    loan.return_date = return_date
    loan.returned_to = returned_to
    if remarks:
        loan.remarks = (loan.remarks + "\n" + remarks).strip() if loan.remarks else remarks
    if mark_lost:
        loan.status = Borrowing.Status.LOST
        loan.return_condition = "LOST"
        if loan.copy_id:
            BookCopy.objects.filter(pk=loan.copy_id).update(status=BookCopy.Status.LOST)
    elif mark_damaged:
        loan.status = Borrowing.Status.DAMAGED
        loan.return_condition = condition or "DAMAGED"
        if loan.copy_id:
            BookCopy.objects.filter(pk=loan.copy_id).update(
                status=BookCopy.Status.DAMAGED,
                condition=condition or BookCopy.Condition.DAMAGED,
            )
    else:
        loan.status = Borrowing.Status.RETURNED
        loan.return_condition = condition or BookCopy.Condition.GOOD
        if loan.copy_id:
            BookCopy.objects.filter(pk=loan.copy_id).update(
                status=BookCopy.Status.AVAILABLE,
                condition=condition or BookCopy.Condition.GOOD,
            )
    loan.save()
    try:
        from .notifications import notify_loan_returned
        notify_loan_returned(loan)
    except Exception:
        pass
    return loan


def mark_overdue(school) -> int:
    today = timezone.localdate()
    return Borrowing.objects.filter(
        school=school,
        status=Borrowing.Status.ACTIVE,
        due_date__lt=today,
    ).update(status=Borrowing.Status.OVERDUE)


@transaction.atomic
def allocate_class_textbooks(
    *,
    school,
    name: str,
    grade_label: str = "",
    academic_year: str = "",
    term: str = "",
    book: Book,
    student_ids: list | None = None,
    quantity: int | None = None,
    individual: bool = True,
    created_by=None,
    due_date=None,
    notes: str = "",
):
    """
    Allocate available copies of a title to a class.
    individual=True: one copy per student id (accountability).
    individual=False: reserve `quantity` copies for class pool (no student).
    """
    from .models import ClassAllocation, ClassAllocationItem  # noqa: F401

    available = list(
        BookCopy.objects.select_for_update()
        .filter(school=school, book=book, status=BookCopy.Status.AVAILABLE)
        .order_by("accession_number")
    )
    if individual:
        student_ids = student_ids or []
        need = len(student_ids)
        if need < 1:
            raise ValidationError("Select at least one learner for individual allocation.")
        if len(available) < need:
            raise ValidationError(
                f"Only {len(available)} available copies; need {need}."
            )
        alloc = ClassAllocation.objects.create(
            school=school,
            name=name or f"{book.title} — {grade_label}",
            kind=ClassAllocation.Kind.INDIVIDUAL,
            grade_label=grade_label or "",
            academic_year=academic_year or "",
            term=term or "",
            notes=notes or "",
            created_by=created_by,
        )
        from apps.students.models import Student

        items = []
        for sid, copy in zip(student_ids, available[:need]):
            student = Student.objects.filter(pk=sid, school=school).first()
            if not student:
                raise ValidationError(f"Student {sid} not found in this school.")
            loan = issue_copy(
                school=school,
                copy=copy,
                student=student,
                due_date=due_date,
                issued_by=created_by,
                academic_year=academic_year or "",
                term=term or "",
                remarks=f"Class allocation: {alloc.name}",
                is_allocation_loan=True,
            )
            items.append(
                ClassAllocationItem.objects.create(
                    allocation=alloc, copy=copy, student=student, loan=loan
                )
            )
        return alloc, items
    else:
        need = int(quantity or 0)
        if need < 1:
            raise ValidationError("quantity required for class-level allocation.")
        if len(available) < need:
            raise ValidationError(
                f"Only {len(available)} available copies; need {need}."
            )
        alloc = ClassAllocation.objects.create(
            school=school,
            name=name or f"{book.title} — {grade_label} (class pool)",
            kind=ClassAllocation.Kind.CLASS_POOL,
            grade_label=grade_label or "",
            academic_year=academic_year or "",
            term=term or "",
            notes=notes or "",
            created_by=created_by,
        )
        items = []
        for copy in available[:need]:
            copy.status = BookCopy.Status.ISSUED
            copy.save(update_fields=["status"])
            items.append(
                ClassAllocationItem.objects.create(
                    allocation=alloc, copy=copy, student=None, loan=None
                )
            )
        return alloc, items



def receive_acquisition(*, acquisition, received_by=None, accession_prefix: str = "") -> dict:
    """Mark acquisition received and register physical copies for each line. Idempotent if already RECEIVED."""
    from django.utils import timezone
    from django.db import transaction
    from .models import Acquisition, BookCopy

    if acquisition.status == Acquisition.Status.RECEIVED:
        return {"status": "already_received", "copies": 0}
    if acquisition.status == Acquisition.Status.CANCELLED:
        raise ValueError("Acquisition is cancelled.")

    created = 0
    with transaction.atomic():
        for line in acquisition.lines.select_related("book"):
            prefix = (accession_prefix or "ACQ").strip()[:12]
            new_copies = register_copies(
                school=acquisition.school,
                book=line.book,
                count=int(line.quantity or 0),
                accession_prefix=prefix,
                condition="NEW",
                acquisition_source=acquisition.source_type,
            )
            created += len(new_copies)
            for c in new_copies:
                if acquisition.supplier_or_donor:
                    BookCopy.objects.filter(pk=c.pk).update(
                        acquisition_source=f"{acquisition.source_type}:{acquisition.supplier_or_donor}"[:120]
                    )
        acquisition.status = Acquisition.Status.RECEIVED
        acquisition.received_at = timezone.now()
        acquisition.save(update_fields=["status", "received_at"])
    return {"status": "received", "copies": created}
