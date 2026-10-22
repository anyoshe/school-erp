"""Expenses, vendors, bills, owner standing, student statements."""
from decimal import Decimal
from datetime import date

from django.db.models import Sum
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school
from .models import (
    ExpenseCategory, Vendor, Expense, Bill, BillPayment, CashLedgerEntry,
    Invoice, Payment, IncomeReceipt,
)


def _school(request):
    return selected_school(request)


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ["id", "name", "description", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ["id", "name", "phone", "email", "address", "notes", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)

    class Meta:
        model = Expense
        fields = [
            "id", "category", "category_name", "vendor", "vendor_name",
            "title", "description", "amount", "expense_date", "payment_method",
            "reference_number", "paid_to", "academic_year", "term",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BillPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillPayment
        fields = [
            "id", "bill", "amount", "payment_date", "payment_method",
            "reference_number", "notes", "created_at",
        ]
        read_only_fields = ["id", "created_at", "bill"]


class BillSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    payments = BillPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Bill
        fields = [
            "id", "vendor", "vendor_name", "bill_number", "description",
            "amount", "amount_paid", "balance", "bill_date", "due_date",
            "status", "category", "category_name", "academic_year", "term",
            "payments", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "amount_paid", "balance", "created_at", "updated_at"]


class SchoolScopedMixin:
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_school(self):
        return _school(self.request)


class ExpenseCategoryViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    serializer_class = ExpenseCategorySerializer

    def get_queryset(self):
        school = self.get_school()
        return ExpenseCategory.objects.filter(school=school) if school else ExpenseCategory.objects.none()

    def perform_create(self, serializer):
        serializer.save(school=self.get_school())


class VendorViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    serializer_class = VendorSerializer

    def get_queryset(self):
        school = self.get_school()
        return Vendor.objects.filter(school=school) if school else Vendor.objects.none()

    def perform_create(self, serializer):
        serializer.save(school=self.get_school())


class ExpenseViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        school = self.get_school()
        if not school:
            return Expense.objects.none()
        qs = Expense.objects.filter(school=school).select_related("category", "vendor")
        year = self.request.query_params.get("academic_year")
        term = self.request.query_params.get("term")
        if year:
            qs = qs.filter(academic_year=year)
        if term:
            qs = qs.filter(term=term)
        return qs

    def perform_create(self, serializer):
        school = self.get_school()
        exp = serializer.save(school=school, created_by=self.request.user)
        CashLedgerEntry.objects.create(
            school=school,
            direction=CashLedgerEntry.Direction.OUT,
            amount=exp.amount,
            entry_date=exp.expense_date,
            description=f"Expense: {exp.title}",
            reference_number=exp.reference_number or "",
            source_type="expense",
            source_id=exp.id,
        )

    def perform_destroy(self, instance):
        CashLedgerEntry.objects.filter(source_type="expense", source_id=instance.id).delete()
        instance.delete()


class BillViewSet(SchoolScopedMixin, viewsets.ModelViewSet):
    serializer_class = BillSerializer

    def get_queryset(self):
        school = self.get_school()
        if not school:
            return Bill.objects.none()
        qs = Bill.objects.filter(school=school).select_related("vendor", "category").prefetch_related("payments")
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st.upper())
        return qs

    def perform_create(self, serializer):
        school = self.get_school()
        amount = serializer.validated_data.get("amount") or Decimal("0")
        serializer.save(
            school=school,
            created_by=self.request.user,
            amount_paid=Decimal("0"),
            balance=amount,
            status=Bill.Status.OPEN,
        )

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        bill = self.get_object()
        if bill.status == Bill.Status.CANCELLED:
            return Response({"detail": "Cannot pay a cancelled bill"}, status=400)
        try:
            amount = Decimal(str(request.data.get("amount") or 0))
        except Exception:
            return Response({"detail": "Invalid amount"}, status=400)
        if amount <= 0:
            return Response({"detail": "Amount must be positive"}, status=400)
        if bill.balance > 0 and amount > bill.balance:
            amount = bill.balance

        payment_date = request.data.get("payment_date") or date.today().isoformat()
        method = request.data.get("payment_method") or "BANK"
        ref = request.data.get("reference_number") or ""
        notes = request.data.get("notes") or ""

        pay = BillPayment.objects.create(
            school=bill.school,
            bill=bill,
            amount=amount,
            payment_date=payment_date,
            payment_method=method,
            reference_number=ref,
            notes=notes,
            created_by=request.user,
        )
        bill.refresh_payment_state()

        CashLedgerEntry.objects.create(
            school=bill.school,
            direction=CashLedgerEntry.Direction.OUT,
            amount=amount,
            entry_date=pay.payment_date,
            description=f"Bill payment: {bill.bill_number} ({bill.vendor.name})",
            reference_number=ref,
            source_type="bill_payment",
            source_id=pay.id,
        )

        if request.data.get("record_expense", True) in (True, "true", "1", 1):
            Expense.objects.create(
                school=bill.school,
                category=bill.category,
                vendor=bill.vendor,
                title=f"Bill {bill.bill_number}",
                description=bill.description or f"Payment on bill {bill.bill_number}",
                amount=amount,
                expense_date=pay.payment_date,
                payment_method=method,
                reference_number=ref,
                paid_to=bill.vendor.name,
                academic_year=bill.academic_year,
                term=bill.term,
                created_by=request.user,
            )

        return Response(BillSerializer(bill).data)


class OwnerStandingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        if not school:
            return Response({"detail": "School context required"}, status=400)

        # Term / school fees actually posted to finance Payment (exclude internal transfers)
        fee_collected = (
            Payment.objects.filter(school=school).exclude(payment_method="TRANSFER").aggregate(t=Sum("amount"))["t"]
            or Decimal("0")
        )
        interview_income = (
            IncomeReceipt.objects.filter(school=school, source="INTERVIEW").aggregate(t=Sum("amount"))["t"]
            or Decimal("0")
        )
        admission_income = (
            IncomeReceipt.objects.filter(school=school, source="ADMISSION").aggregate(t=Sum("amount"))["t"]
            or Decimal("0")
        )
        other_income = (
            IncomeReceipt.objects.filter(school=school, source="OTHER").aggregate(t=Sum("amount"))["t"]
            or Decimal("0")
        )
        pre_enroll = interview_income + admission_income + other_income
        total_income = fee_collected + pre_enroll
        total_expenses = Expense.objects.filter(school=school).aggregate(t=Sum("amount"))["t"] or Decimal("0")
        payables = (
            Bill.objects.filter(school=school).exclude(status__in=["PAID", "CANCELLED"]).aggregate(t=Sum("balance"))["t"]
            or Decimal("0")
        )
        receivables = (
            Invoice.objects.filter(school=school, is_paid=False).aggregate(t=Sum("balance"))["t"] or Decimal("0")
        )

        by_category = list(
            Expense.objects.filter(school=school)
            .values("category__name")
            .annotate(total=Sum("amount"))
            .order_by("-total")[:15]
        )

        return Response({
            "total_fee_collected": str(fee_collected),
            "interview_income": str(interview_income),
            "admission_income": str(admission_income),
            "other_income": str(other_income),
            "pre_enrollment_income": str(pre_enroll),
            "total_income": str(total_income),
            "total_expenses": str(total_expenses),
            "net_position": str(total_income - total_expenses),
            "receivables_outstanding": str(receivables),
            "payables_outstanding": str(payables),
            "income_breakdown": [
                {"label": "School / term fees", "total": str(fee_collected)},
                {"label": "Interview fees", "total": str(interview_income)},
                {"label": "Admission / registration fees", "total": str(admission_income)},
                {"label": "Other income", "total": str(other_income)},
            ],
            "expenses_by_category": [
                {"category": r["category__name"] or "Uncategorised", "total": str(r["total"] or 0)}
                for r in by_category
            ],
        })


class StudentFeeStatementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        from apps.students.models import Student

        school = _school(request)
        try:
            student = Student.objects.select_related("school", "current_class").get(id=student_id)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=404)

        if school and student.school_id != school.id:
            return Response({"detail": "Wrong school"}, status=403)

        invoices = Invoice.objects.filter(student=student).order_by("academic_year", "term", "due_date")
        lines = []
        total_due = Decimal("0")
        total_paid = Decimal("0")
        for inv in invoices:
            pays = list(
                Payment.objects.filter(invoice=inv)
                .exclude(payment_method="TRANSFER")
                .order_by("paid_at")
                .values("amount", "paid_at", "payment_method", "reference_number", "notes")
            )
            total_due += Decimal(str(inv.amount_due or 0)) + Decimal(str(inv.late_fee_applied or 0))
            paid_real = sum(Decimal(str(p["amount"])) for p in pays)
            total_paid += paid_real
            lines.append({
                "invoice_number": inv.invoice_number,
                "term": inv.term,
                "academic_year": inv.academic_year,
                "due_date": inv.due_date,
                "amount_due": str(inv.amount_due),
                "late_fee": str(inv.late_fee_applied or 0),
                "amount_paid": str(paid_real),
                "balance": str(inv.balance),
                "is_paid": inv.is_paid,
                "payments": [
                    {
                        "amount": str(p["amount"]),
                        "paid_at": p["paid_at"],
                        "method": p["payment_method"],
                        "reference": p["reference_number"] or "",
                        "notes": p["notes"] or "",
                    }
                    for p in pays
                ],
            })

        income = list(
            IncomeReceipt.objects.filter(student=student).values(
                "source", "amount", "paid_at", "reference_number"
            )
        )
        balance = max(Decimal("0"), total_due - total_paid)

        return Response({
            "student": {
                "id": str(student.id),
                "full_name": student.full_name,
                "admission_number": student.admission_number,
                "class": getattr(student.current_class, "name", None),
            },
            "school": {
                "name": student.school.name if student.school_id else "",
                "currency": getattr(student.school, "currency", "KES") if student.school_id else "KES",
            },
            "invoices": lines,
            "pre_enrollment_income": [
                {
                    "source": r["source"],
                    "amount": str(r["amount"]),
                    "paid_at": r["paid_at"],
                    "reference": r.get("reference_number") or "",
                }
                for r in income
            ],
            "summary": {
                "total_invoiced": str(total_due),
                "total_paid": str(total_paid),
                "balance": str(balance),
            },
            "generated_at": date.today().isoformat(),
        })
