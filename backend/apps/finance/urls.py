from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FeeStructureViewSet, StudentLedgerViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r'fee-structures', FeeStructureViewSet, basename='fee-structures')
router.register(r'student-ledger', StudentLedgerViewSet, basename='student-ledger')
router.register(r'payments', PaymentViewSet, basename='payments')

urlpatterns = [
    path('', include(router.urls)),
]
