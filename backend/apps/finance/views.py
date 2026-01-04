from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import FeeStructure, StudentLedger, Payment
from .serializers import (
    FeeStructureSerializer,
    FeeStructureCreateUpdateSerializer,
    StudentLedgerSerializer,
    StudentLedgerCreateUpdateSerializer,
    PaymentSerializer,
    PaymentCreateUpdateSerializer
)

# ----------------------------
# FEE STRUCTURE VIEWSET
# ----------------------------
class FeeStructureViewSet(ModelViewSet):
    queryset = FeeStructure.objects.select_related('class_fk').all().order_by('class_fk__name', 'term')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeStructureCreateUpdateSerializer
        return FeeStructureSerializer


# ----------------------------
# STUDENT LEDGER VIEWSET
# ----------------------------
class StudentLedgerViewSet(ModelViewSet):
    queryset = StudentLedger.objects.select_related('student').all().order_by('-date')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentLedgerCreateUpdateSerializer
        return StudentLedgerSerializer


# ----------------------------
# PAYMENT VIEWSET
# ----------------------------
class PaymentViewSet(ModelViewSet):
    queryset = Payment.objects.select_related('student').all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentCreateUpdateSerializer
        return PaymentSerializer
