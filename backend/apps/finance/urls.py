# finance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IncomeReceiptListView,
    FeeCategoryViewSet, FeeItemViewSet, FeeStructureViewSet,
    StudentFeeAssignmentViewSet, InvoiceViewSet, PaymentViewSet, PaymentPlanViewSet,
    FinanceDashboardSummaryView,
    AwaitingClearanceView,
    ClearanceAddItemView, ClearancePrepareView, ClearanceAdjustLineView,
)
from .accounting_views import (
    ExpenseCategoryViewSet,
    VendorViewSet,
    ExpenseViewSet,
    BillViewSet,
    OwnerStandingView,
    StudentFeeStatementView,
)

router = DefaultRouter()
router.register(r'categories', FeeCategoryViewSet, basename='fee-category')
router.register(r'items', FeeItemViewSet, basename='fee-item')
router.register(r'structures', FeeStructureViewSet, basename='fee-structure')
router.register(r'student-assignments', StudentFeeAssignmentViewSet, basename='student-fee-assignment')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'payment-plans', PaymentPlanViewSet, basename='payment-plan')
router.register(r'expense-categories', ExpenseCategoryViewSet, basename='expense-category')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'bills', BillViewSet, basename='bill')

urlpatterns = [
    path('income-receipts/', IncomeReceiptListView.as_view(), name='income-receipts'),
    path('dashboard-summary/', FinanceDashboardSummaryView.as_view(), name='finance-dashboard-summary'),
    path('awaiting-clearance/', AwaitingClearanceView.as_view(), name='awaiting-clearance'),
    path('awaiting-clearance/<uuid:student_id>/add-item/', ClearanceAddItemView, ClearancePrepareView, ClearanceAdjustLineView.as_view(), name='clearance-add-item'),
    path('awaiting-clearance/<uuid:student_id>/prepare/', ClearancePrepareView.as_view(), name='clearance-prepare'),
    path('clearance/lines/<uuid:line_id>/', ClearanceAdjustLineView.as_view(), name='clearance-adjust-line'),
    path('owner-standing/', OwnerStandingView.as_view(), name='owner-standing'),
    path('students/<uuid:student_id>/statement/', StudentFeeStatementView.as_view(), name='student-fee-statement'),
    path('', include(router.urls)),
]
