from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    FeeCategory, FeeItem, FeeStructure, StudentFeeAssignment, PaymentPlan,
    Invoice, Payment
)
from .serializers import (
    FeeCategorySerializer, FeeCategoryCreateUpdateSerializer,
    FeeItemSerializer, FeeItemCreateUpdateSerializer,
    FeeStructureSerializer, FeeStructureCreateUpdateSerializer,
    StudentFeeAssignmentSerializer, StudentFeeAssignmentCreateUpdateSerializer,
    InvoiceSerializer, InvoiceCreateUpdateSerializer,
    PaymentSerializer, PaymentCreateUpdateSerializer, PaymentPlanSerializer
)
from apps.core.permissions import IsAssociatedWithSchool  # Assume you have this
from django.utils import timezone


class FeeCategoryViewSet(viewsets.ModelViewSet):
    queryset = FeeCategory.objects.select_related('school').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'is_mandatory']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeCategoryCreateUpdateSerializer
        return FeeCategorySerializer

    def get_queryset(self):
        queryset = self.queryset
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset


class FeeItemViewSet(viewsets.ModelViewSet):
    queryset = FeeItem.objects.select_related('category').prefetch_related('grade_levels').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'is_active', 'is_statutory']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeItemCreateUpdateSerializer
        return FeeItemSerializer

    def get_queryset(self):
        queryset = self.queryset
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            queryset = queryset.filter(category__school_id=school_id)
        return queryset

    @action(detail=False, methods=['get'], url_path='by-category/(?P<category_id>[^/.]+)')
    def by_category(self, request, category_id=None):
        items = self.get_queryset().filter(category_id=category_id)
        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)


class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related('school', 'grade_level')\
        .prefetch_related('structure_items__item__category').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'grade_level', 'is_active']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeStructureCreateUpdateSerializer
        return FeeStructureSerializer


    def get_queryset(self):
        queryset = self.queryset
        
        # Filter by School Header (Existing)
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
            
        # NEW: Filter by Grade Level from URL params
        grade_level = self.request.query_params.get('grade_level')
        if grade_level:
            queryset = queryset.filter(grade_level_id=grade_level)
            
        # NEW: Filter by Active status if requested
        is_active = self.request.query_params.get('is_active')
        if is_active:
            queryset = queryset.filter(is_active=(is_active.lower() == 'true'))
            
        return queryset

    @action(detail=True, methods=['get'], url_path='preview')
    def preview(self, request, pk=None):
        structure = self.get_object()
        return Response({
            'total_amount': structure.total_amount,
            'items_by_category': structure.get_items_by_category()
        })

class StudentFeeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = StudentFeeAssignment.objects.select_related('student', 'fee_structure').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'fee_structure', 'is_waived']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentFeeAssignmentCreateUpdateSerializer
        return StudentFeeAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        # Correct: user has many schools via related_name='schools'
        return self.queryset.filter(school__in=user.schools.all())

    # @action(detail=True, methods=['post'], url_path='generate-invoice')
    # def generate_invoice(self, request, pk=None):
    #     assignment = self.get_object()
    #     term = request.data.get('term', 'Term 1')
    #     academic_year = request.data.get('academic_year', assignment.fee_structure.academic_year)

    #     invoice = Invoice.objects.create(
    #         student=assignment.student,
    #         fee_assignment=assignment,
    #         term=term,
    #         academic_year=academic_year,
    #         amount_due=assignment.effective_total,
    #         due_date=timezone.now().date() + timezone.timedelta(days=30),
    #         generated_by=request.user
    #     )

    #     return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
    @action(detail=True, methods=['post'], url_path='generate-invoice')
    def generate_invoice(self, request, pk=None):
        assignment = self.get_object()
        plan = assignment.payment_plan
        
        # Determine the start date for payment schedules
        start_date = timezone.now().date()
        academic_year = request.data.get('academic_year', assignment.fee_structure.academic_year)
        term = request.data.get('term', assignment.fee_structure.period_name)

        # 1. Logic for Single/Full Payment (No Plan)
        if not plan or plan.number_of_installments <= 1:
            invoice = Invoice.objects.create(
                student=assignment.student,
                fee_assignment=assignment,
                school=assignment.student.school,
                term=term,
                academic_year=academic_year,
                amount_due=assignment.effective_total,
                due_date=start_date + timedelta(days=14), # Default 2 weeks
                generated_by=request.user
            )
            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

        # 2. Logic for Flexible Installments (Weekly, Monthly, etc.)
        total_amount = assignment.effective_total
        num_installments = plan.number_of_installments
        amount_per_installment = total_amount / num_installments
        
        # Determine interval based on plan_type (from your model choices)
        interval_map = {
            'weekly': 7,
            'monthly': 30,
            'quarterly': 90,
            'semester': 120,
            'termly': 120, # Adjust based on your school calendar
        }
        days_step = interval_map.get(plan.plan_type.lower(), 30)

        created_invoices = []
        for i in range(num_installments):
            due_date = start_date + timedelta(days=(i * days_step))
            
            invoice = Invoice.objects.create(
                student=assignment.student,
                fee_assignment=assignment,
                school=assignment.student.school,
                payment_plan=plan,
                installment_number=i + 1,
                term=term,
                academic_year=academic_year,
                amount_due=amount_per_installment,
                due_date=due_date,
                generated_by=request.user
            )
            created_invoices.append(invoice)

        return Response(
            InvoiceSerializer(created_invoices, many=True).data, 
            status=status.HTTP_201_CREATED
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('student', 'fee_assignment__fee_structure').prefetch_related('payments').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'term', 'academic_year', 'is_paid']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InvoiceCreateUpdateSerializer
        return InvoiceSerializer

  
    def get_queryset(self):
        user = self.request.user
        # Correct: user has many schools via related_name='schools'
        return self.queryset.filter(school__in=user.schools.all())

    @action(detail=False, methods=['get'], url_path='overdue')
    def overdue_invoices(self, request):
        overdue = self.get_queryset().filter(due_date__lt=timezone.now().date(), is_paid=False)
        serializer = self.get_serializer(overdue, many=True)
        return Response(serializer.data)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('invoice__student', 'paid_by').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['invoice', 'payment_method', 'paid_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentCreateUpdateSerializer
        return PaymentSerializer

    # def get_queryset(self):
    #     return self.queryset.filter(invoice__student__school=self.request.user.school)
    def get_queryset(self):
        user = self.request.user
        # Correct: user has many schools via related_name='schools'
        return self.queryset.filter(school__in=user.schools.all())

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        payment.invoice.refresh_from_db()  # Re-calculate balance
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

# class PaymentPlanViewSet(viewsets.ModelViewSet):
#     queryset = PaymentPlan.objects.prefetch_related('installments').all()
#     serializer_class = PaymentPlanSerializer
#     permission_classes = [IsAuthenticated]

#     def get_queryset(self):
#         school_id = self.request.headers.get('X-School-ID')
#         if school_id:
#             return self.queryset.filter(school_id=school_id)
#         return self.queryset
    
class PaymentPlanViewSet(viewsets.ModelViewSet):
    queryset = PaymentPlan.objects.prefetch_related('installments').all()
    serializer_class = PaymentPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Filtering so users only see plans for their specific school
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            return self.queryset.filter(school_id=school_id)
        return self.queryset

    def perform_create(self, serializer):
        # This is CRITICAL: It picks up the school ID from your dashboard header
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            # Fallback for testing: pick the first school the user is assigned to
            school_id = self.request.user.schools.first().id
            
        serializer.save(school_id=school_id)