"""Record opening / migration balances as proper invoices."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school


class OpeningBalanceView(APIView):
    """
    Create an arrears / opening-balance invoice for a student
    (paper-book migration, mid-year join, or prior-system balance).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)

        from apps.finance.carryover import ensure_arrears_fee_item
        from apps.finance.models import Invoice, InvoiceLine, StudentFeeAssignment
        from apps.students.models import Student

        student_id = request.data.get("student_id") or request.data.get("student")
        amount_raw = request.data.get("amount")
        academic_year = (request.data.get("academic_year") or "").strip() or str(date.today().year)
        term = (request.data.get("term") or "").strip() or "Opening"
        notes = (request.data.get("notes") or "").strip()
        due_raw = request.data.get("due_date")

        if not student_id:
            return Response({"detail": "student_id is required"}, status=400)
        try:
            amount = Decimal(str(amount_raw or 0)).quantize(Decimal("0.01"))
        except Exception:
            return Response({"detail": "Invalid amount"}, status=400)
        if amount <= 0:
            return Response({"detail": "Amount must be greater than zero"}, status=400)

        student = Student.objects.filter(pk=student_id, school=school).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)

        try:
            due = date.fromisoformat(str(due_raw)[:10]) if due_raw else date.today() + timedelta(days=14)
        except Exception:
            due = date.today() + timedelta(days=14)

        user = request.user if getattr(request.user, "is_authenticated", False) else None
        item = ensure_arrears_fee_item(school)

        with transaction.atomic():
            assignment, _ = StudentFeeAssignment.objects.get_or_create(
                student=student,
                defaults={
                    "fee_structure": getattr(student, "fee_structure", None),
                    "assigned_by": user,
                },
            )
            max_inst = (
                Invoice.objects.filter(student=student, fee_assignment=assignment)
                .order_by("-installment_number")
                .values_list("installment_number", flat=True)
                .first()
            ) or 0

            inv = Invoice(
                student=student,
                school=school,
                fee_assignment=assignment,
                academic_year=academic_year[:20],
                term=term[:50],
                amount_due=amount,
                amount_paid=Decimal("0"),
                balance=amount,
                is_paid=False,
                due_date=due,
                installment_number=max_inst + 1,
                generated_by=user,
            )
            # Let model generate invoice_number on save if configured
            inv.save()
            InvoiceLine.objects.create(
                invoice=inv,
                item=item,
                description=(notes or f"Opening balance / arrears — {term} {academic_year}")[:200],
                amount=amount,
            )
            # Keep totals consistent if signals don't run
            inv.amount_due = amount
            inv.balance = amount
            inv.is_paid = False
            inv.save(update_fields=["amount_due", "balance", "is_paid"])

        return Response(
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "student_id": str(student.id),
                "amount": float(amount),
                "balance": float(inv.balance or amount),
                "academic_year": inv.academic_year,
                "term": inv.term,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
            },
            status=201,
        )
