# finance/urls.py
from django.urls import path, include
from apps.finance import views 
from rest_framework.routers import DefaultRouter
from .views import (
    IncomeReceiptListView,
    FeeCategoryViewSet, FeeItemViewSet, FeeStructureViewSet,
    StudentFeeAssignmentViewSet, InvoiceViewSet, PaymentViewSet, PaymentPlanViewSet,
    FinanceDashboardSummaryView,
)

router = DefaultRouter()
router.register(r'categories', FeeCategoryViewSet, basename='fee-category')
router.register(r'items', FeeItemViewSet, basename='fee-item')
router.register(r'structures', FeeStructureViewSet, basename='fee-structure')
router.register(r'student-assignments', StudentFeeAssignmentViewSet, basename='student-fee-assignment')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
# Ensure this matches exactly what the frontend calls: api.get("finance/payment-plans/")
router.register(r'payment-plans', PaymentPlanViewSet, basename='payment-plan')

urlpatterns = [
    path('income-receipts/', IncomeReceiptListView.as_view(), name='income-receipts'),
    path('dashboard-summary/', FinanceDashboardSummaryView.as_view(), name='finance-dashboard-summary'),
    path('', include(router.urls)),
]
