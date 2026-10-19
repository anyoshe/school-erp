from decimal import Decimal
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Sum
from decimal import Decimal
from .models import Student, Guardian, StudentGuardian, MedicalRecord
from .serializers import (
    StudentSerializer, StudentListSerializer, StudentEditSerializer, StudentCreateUpdateSerializer,
    GuardianSerializer,
    StudentGuardianSerializer, LinkExistingGuardianSerializer,
    MedicalRecordSerializer, MedicalRecordCreateUpdateSerializer
)
from apps.school.support import accessible_school_ids, selected_school
from rest_framework.exceptions import PermissionDenied


class StudentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for students - full CRUD + reports
    """
    # Base queryset kept lean; list uses even lighter select_related
    queryset = Student.objects.select_related("current_class")
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        'school', 'status', 'current_class', 'gender', 'nationality',
        'boarding_status', 'fee_structure'
    ]
    search_fields = [
        'first_name', 'last_name', 'admission_number', 'learner_id',
        'national_student_id'
    ]
    ordering_fields = ['admission_number', 'admission_date', 'status', 'current_class']
    ordering = ['last_name', 'first_name']

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Student.objects.none()

        qs = Student.objects.filter(school_id__in=accessible_school_ids(self.request))

        # Prefer active school header when present (smaller result set)
        school = selected_school(self.request)
        if school is not None:
            qs = qs.filter(school_id=school.id)

        if self.action == "list":
            return qs.select_related(
                "current_class", "section", "pathway", "track", "stream"
            ).defer(
                "photo",
                "allergies",
                "chronic_conditions",
                "special_needs",
                "notes",
                "address",
            )

        # Detail: full profile vs lightweight edit form
        mode = ""
        if getattr(self, "request", None) is not None:
            mode = (self.request.query_params.get("mode") or "").lower()
        if self.action == "retrieve" and mode in ("edit", "lite", "form"):
            return qs.select_related("current_class").prefetch_related(
                "guardians__guardian"
            )
        return qs.select_related(
            "school", "current_class", "fee_structure", "created_by"
        ).prefetch_related(
            "guardians__guardian",
            "student_medical_record__documents",
        )

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentCreateUpdateSerializer
        if self.action == "list":
            return StudentListSerializer
        # Edit dialog / lightweight profile: ?mode=edit
        if self.action == "retrieve":
            mode = (self.request.query_params.get("mode") or "").lower()
            if mode in ("edit", "lite", "form"):
                return StudentEditSerializer
        return StudentSerializer

    def _validate_school_relations(self, validated_data, school):
        for field in ("current_class", "section", "pathway", "track", "stream", "academic_year", "fee_structure"):
            related = validated_data.get(field)
            related_school_id = getattr(related, "school_id", None)
            if related and related_school_id and related_school_id != school.id:
                raise PermissionDenied(f"{field} must belong to the selected school.")

    def perform_create(self, serializer):
        school = selected_school(self.request)
        self._validate_school_relations(serializer.validated_data, school)
        serializer.save(school=school)

    def perform_update(self, serializer):
        school = selected_school(self.request)
        self._validate_school_relations(serializer.validated_data, school)
        serializer.save(school=school)

    @action(detail=False, methods=['get'], url_path='outstanding-fees')
    def outstanding_fees_report(self, request):
        """
        List students with outstanding fees (dynamic from finance)
        """
        students = self.get_queryset()
        data = []
        for student in students:
            balance = student.get_outstanding_balance()
            if balance > 0:
                data.append({
                    'id': str(student.id),
                    'full_name': student.full_name,
                    'admission_number': student.admission_number,
                    'balance': float(balance),
                    'fee_structure': str(student.fee_structure) if student.fee_structure else 'None'
                })
        return Response(data)

    @action(detail=True, methods=['get'], url_path='balance')
    def get_balance(self, request, pk=None):
        student = self.get_object()
        return Response({'outstanding_balance': float(student.get_outstanding_balance())})


    @action(detail=True, methods=['get'], url_path='finance-summary')
    def finance_summary(self, request, pk=None):
        student = self.get_object()
        from apps.finance.models import StudentFeeAssignment, Invoice, Payment
        from apps.admissions.models import AdmissionFeePayment
        from decimal import Decimal
        from django.db.models import Sum

        # Fetch data
        assignment = StudentFeeAssignment.objects.filter(student=student).select_related(
            'fee_structure', 'payment_plan'
        ).prefetch_related('selected_optional_items').first()

        invoices = Invoice.objects.filter(student=student).select_related(
            'fee_assignment', 'payment_plan'
        ).order_by('-due_date')

        payments = Payment.objects.filter(invoice__student=student).select_related('invoice', 'paid_by').order_by('-paid_at')
        admission_payments = AdmissionFeePayment.objects.filter(application__student=student).order_by('-payment_date')

        # Initialize
        fee_structure_total = Decimal('0')
        effective_total = Decimal('0')
        remaining_total = Decimal('0')
        admission_total = Decimal('0')
        other_mandatory_total = Decimal('0')
        optional_total = Decimal('0')
        net_admission_total = Decimal('0')
        total_due_now = Decimal('0')
        deposit_paid_amount = Decimal('0')
        outstanding_balance = Decimal('0')
        balance_due = Decimal('0')

        assignment_data = None
        fee_structure = None

        # ====================== FEE ASSIGNMENT & BREAKDOWN ======================
        if assignment:
            fee_structure = assignment.fee_structure
            fee_structure_total = Decimal(str(assignment.fee_structure.total_amount or 0)) if assignment.fee_structure else Decimal('0')
            effective_total = Decimal(str(assignment.effective_total or 0))
            remaining_total = Decimal(str(assignment.remaining_total or 0))

            assignment_data = {
                'id': str(assignment.id),
                'fee_structure': assignment.fee_structure.name if assignment.fee_structure else None,
                'fee_structure_id': str(assignment.fee_structure_id) if assignment.fee_structure_id else None,
                'payment_plan': {
                    'id': str(assignment.payment_plan.id) if assignment.payment_plan else None,
                    'name': assignment.payment_plan.name if assignment.payment_plan else None,
                    'plan_type': assignment.payment_plan.plan_type if assignment.payment_plan else None,
                    'number_of_installments': assignment.payment_plan.number_of_installments if assignment.payment_plan else 0,
                    'first_installment_percentage': float(assignment.payment_plan.first_installment_percentage or 0),
                } if assignment.payment_plan else None,
                    'waiver_amount': float(assignment.waiver_amount or 0),
                'waiver_reason': assignment.waiver_reason or "",
                'is_waived': assignment.is_waived,
                'effective_total': float(assignment.effective_total or 0),
                'remaining_total': float(assignment.remaining_total or 0),
                'selected_optional_items': [
                    {'id': str(item.id), 'name': item.name} for item in assignment.selected_optional_items.all()
                ]
            }
        elif student.fee_structure:
            fee_structure = student.fee_structure
            fee_structure_total = Decimal(str(fee_structure.total_amount or 0))
            effective_total = fee_structure_total

        # Fee breakdown for transparency
        if fee_structure:
            structure_items = fee_structure.structure_items.select_related('item__category').all()
            optional_item_ids = set(str(item.id) for item in fee_structure.available_optional_items.all())

            admission_items = [si for si in structure_items 
                              if (getattr(si.item.category, 'name', '') or '').strip().lower() == 'admission & registration']
            admission_item_ids = {str(si.item.id) for si in admission_items}
            admission_total = sum(Decimal(str(si.amount or 0)) for si in admission_items)

            mandatory_items = [si for si in structure_items 
                               if str(si.item.id) not in optional_item_ids or str(si.item.id) in admission_item_ids]

            other_mandatory_items = [si for si in mandatory_items 
                                    if (getattr(si.item.category, 'name', '') or '').strip().lower() != 'admission & registration']
            other_mandatory_total = sum(Decimal(str(si.amount or 0)) for si in other_mandatory_items)

            if assignment:
                selected_optional_item_ids = {
                    str(item.id) for item in assignment.selected_optional_items.all()
                    if str(item.id) not in admission_item_ids
                }
                selected_optional_structure_items = [si for si in structure_items if str(si.item.id) in selected_optional_item_ids]
                optional_total = sum(Decimal(str(si.amount or 0)) for si in selected_optional_structure_items)

            if assignment and assignment.is_waived:
                net_admission_total = max(Decimal('0'), admission_total - Decimal(str(assignment.waiver_amount or 0)))
            else:
                net_admission_total = admission_total

        # ====================== MODERN CALCULATIONS ======================
        total_fee_obligation = effective_total if effective_total > 0 else \
                               (admission_total + other_mandatory_total + optional_total)

        # Deposit paid
        admission_total_paid = admission_payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        deposit_paid_amount = Decimal(str(admission_total_paid))

        if assignment:
            total_due_now = remaining_total
        else:
            total_due_now = max(Decimal('0'), total_fee_obligation - deposit_paid_amount)

      
                # ====================== OUTSTANDING BALANCE CALCULATION ======================
        # Start with invoice-based balance
        invoice_outstanding = Decimal('0')
        for invoice in invoices:
            invoice_balance = getattr(invoice, 'balance', 
                                    Decimal(str(invoice.amount_due)) - Decimal(str(invoice.amount_paid)))
            invoice_outstanding += Decimal(str(invoice_balance))

        # The invoice balances are generated after deposit allocations.
        # If invoices exist, use their outstanding balances directly.
        outstanding_balance = invoice_outstanding

        # If no invoices exist yet, use the calculated total due.
        if not invoices.exists():
            outstanding_balance = total_due_now

        balance_due = outstanding_balance

        # ====================== PREPARE RESPONSE DATA ======================
        # invoices_data = [
        #     {
        #         'id': str(invoice.id),
        #         'invoice_number': invoice.invoice_number,
        #         'amount_due': float(invoice.amount_due),
        #         'amount_paid': float(invoice.amount_paid),
        #         'balance': float(getattr(invoice, 'balance', invoice.amount_due - invoice.amount_paid)),  # Correct unpaid balance
        #         'due_date': invoice.due_date,
        #         'term': invoice.term,
        #         'academic_year': invoice.academic_year,
        #         'is_paid': invoice.is_paid,
        #         'payment_plan': {
        #             'id': str(invoice.payment_plan.id) if invoice.payment_plan else None,
        #             'name': invoice.payment_plan.name if invoice.payment_plan else None,
        #         } if getattr(invoice, 'payment_plan', None) else None,
        #     }
        #     for invoice in invoices
        # ]
        # Allocate admission deposit across invoices once in due-date order only when invoices
        # represent full assignment obligation and have not yet been created from net remaining amount.
        adjusted_invoice_balances = {}
        deposit_remaining = Decimal('0')
        if effective_total <= 0:
            deposit_remaining = deposit_paid_amount

        for invoice in invoices.order_by('due_date', 'id'):
            invoice_balance = Decimal(str(getattr(invoice, 'balance', invoice.amount_due - invoice.amount_paid)))
            credit = min(deposit_remaining, invoice_balance)
            adjusted_invoice_balances[invoice.id] = {
                'balance': max(Decimal('0'), invoice_balance - credit),
                'credited': credit,
            }
            deposit_remaining -= credit
            if deposit_remaining <= 0:
                deposit_remaining = Decimal('0')

        invoices_data = [
            {
                'id': str(invoice.id),
                'invoice_number': invoice.invoice_number,
                'amount_due': float(invoice.amount_due),
                'amount_paid': float(invoice.amount_paid),
                'balance': float(adjusted_invoice_balances.get(invoice.id, {}).get('balance', Decimal(str(getattr(invoice, 'balance', invoice.amount_due - invoice.amount_paid))))),
                'due_date': invoice.due_date,
                'term': invoice.term,
                'academic_year': invoice.academic_year,
                'is_paid': invoice.is_paid or adjusted_invoice_balances.get(invoice.id, {}).get('balance', Decimal('0')) == 0,
                'payment_plan': {
                    'id': str(invoice.payment_plan.id) if invoice.payment_plan else None,
                    'name': invoice.payment_plan.name if invoice.payment_plan else None,
                } if getattr(invoice, 'payment_plan', None) else None,
            }
            for invoice in invoices
        ]
        payments_data = [
            {
                'id': str(payment.id),
                'invoice_id': str(payment.invoice.id),
                'invoice_number': payment.invoice.invoice_number,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'paid_at': payment.paid_at,
                'paid_by': payment.paid_by.guardian.full_name if payment.paid_by else None,
                'notes': payment.notes,
            }
            for payment in payments
        ]

        admission_payments_data = [
            {
                'id': str(payment.id),
                'amount': float(payment.amount),
                'payment_date': payment.payment_date,
                'payment_method': payment.payment_method,
                'receipt_number': payment.receipt_number,
            }
            for payment in admission_payments
        ]
                # Get school currency (add this)
        currency = student.school.currency if hasattr(student.school, 'currency') and student.school.currency else 'KES'
        # Final Response
        return Response({
            'outstanding_balance': float(outstanding_balance),   # Most important for finance
            'effective_total': float(effective_total),           # New: Total after waiver
            'remaining_total': float(remaining_total),
            'fee_structure_total': float(fee_structure_total),
            'admission_amount': float(admission_total),
            'other_mandatory_amount': float(other_mandatory_total),
            'optional_total': float(optional_total),
            'net_admission_amount': float(net_admission_total),
            'total_due_now': float(total_due_now),               # Total obligation - deposit paid
            'deposit_paid': float(deposit_paid_amount),
            'balance_due': float(balance_due),
            'currency': currency,
            'fee_assignment': assignment_data,
            'invoices': invoices_data,
            'payments': payments_data,
            'admission_payments': admission_payments_data,
        })
    @action(detail=False, methods=["post"], url_path="promote")
    def promote(self, request):
        """
        Bulk promote / repeat / graduate students into a target academic year.
        Body: {
          student_ids: [uuid],
          academic_year_id: uuid,
          action: PROMOTE|REPEAT|GRADUATE,
          target_grade_id?: uuid,
          carry_fees?: true,
          carry_term?: "Term 1"
        }
        """
        from apps.academics.models import AcademicYear, GradeLevel
        from .promotion import promote_student

        school = selected_school(request)
        if not school:
            return Response({"detail": "School context required"}, status=400)

        ids = request.data.get("student_ids") or []
        year_id = request.data.get("academic_year_id")
        action = (request.data.get("action") or "PROMOTE").upper()
        carry_fees = request.data.get("carry_fees", True) is not False
        carry_term = request.data.get("carry_term") or "Term 1"
        target_grade_id = request.data.get("target_grade_id")

        if not ids:
            return Response({"detail": "student_ids required"}, status=400)
        if not year_id:
            return Response({"detail": "academic_year_id required"}, status=400)

        try:
            year = AcademicYear.objects.get(id=year_id, school=school)
        except AcademicYear.DoesNotExist:
            return Response({"detail": "Academic year not found"}, status=404)

        target_grade = None
        if target_grade_id:
            try:
                target_grade = GradeLevel.objects.get(id=target_grade_id, school=school)
            except GradeLevel.DoesNotExist:
                return Response({"detail": "Target grade not found"}, status=404)

        students = self.get_queryset().filter(id__in=ids)
        results = []
        errors = []
        for student in students:
            try:
                results.append(
                    promote_student(
                        student,
                        academic_year=year,
                        action=action,
                        target_grade=target_grade,
                        carry_fees=carry_fees,
                        carry_term_label=carry_term,
                        user=request.user,
                    )
                )
            except Exception as e:
                errors.append({"student_id": str(student.id), "error": str(e)})

        return Response({"results": results, "errors": errors, "count": len(results)})

    @action(detail=False, methods=["post"], url_path="carry-term-balances")
    def carry_term_balances(self, request):
        """
        Carry unpaid balances into a target term label for active students.
        Body: { academic_year: "2026/2027", to_term: "Term 2", student_ids?: [] }
        """
        from .promotion import carry_term_balances_for_school

        school = selected_school(request)
        if not school:
            return Response({"detail": "School context required"}, status=400)

        year_label = request.data.get("academic_year") or request.data.get("academic_year_label")
        to_term = request.data.get("to_term") or request.data.get("term")
        ids = request.data.get("student_ids")

        if not year_label or not to_term:
            return Response(
                {"detail": "academic_year and to_term are required"},
                status=400,
            )

        results = carry_term_balances_for_school(
            school,
            academic_year_label=str(year_label),
            to_term=str(to_term),
            student_ids=ids,
            user=request.user,
        )
        return Response({"results": results, "count": len(results)})


class GuardianViewSet(viewsets.ModelViewSet):
    queryset = Guardian.objects.select_related('school')
    serializer_class = GuardianSerializer
    permission_classes = [IsAuthenticated]

    # def get_queryset(self):
    #     return self.queryset.filter(school=self.request.user.school)
    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

    def perform_update(self, serializer):
        serializer.save(school=selected_school(self.request))


class StudentGuardianViewSet(viewsets.ModelViewSet):
    queryset = StudentGuardian.objects.select_related('student', 'guardian')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'guardian', 'is_primary', 'is_active']

    def get_serializer_class(self):
        if self.action == 'link_existing':
            return LinkExistingGuardianSerializer
        return StudentGuardianSerializer

    def get_queryset(self):
        return self.queryset.filter(
            student__school_id__in=accessible_school_ids(self.request)
        )

    @action(detail=False, methods=['post'], url_path='link-existing')
    def link_existing(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(self.get_serializer(instance).data, status=201)


class MedicalRecordViewSet(viewsets.ModelViewSet):
    queryset = MedicalRecord.objects.select_related(
        'student', 'school', 'consent_by', 'recorded_by', 'reviewed_by'
    ).prefetch_related('documents')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'immunization_status']

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MedicalRecordCreateUpdateSerializer
        return MedicalRecordSerializer

    def perform_create(self, serializer):
        school = selected_school(self.request)
        student = serializer.validated_data.get("student")
        if student and student.school_id != school.id:
            raise PermissionDenied("Medical records must belong to the selected school's students.")
        serializer.save(school=school, recorded_by=self.request.user)

    def perform_update(self, serializer):
        school = selected_school(self.request)
        student = serializer.validated_data.get("student", serializer.instance.student)
        if student.school_id != school.id:
            raise PermissionDenied("Medical records must belong to the selected school's students.")
        serializer.save(reviewed_by=self.request.user)