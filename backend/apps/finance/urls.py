# finance/urls.py
from django.urls import path, include
from .returning_billing import ReturningStudentsView, ReturningStudentsBillView
from .lunch_views import (
    LunchEnrollmentListCreateView,
    LunchEnrollmentDetailView,
    LunchKittyView,
    LunchEnsureDefaultsView,
)
from .opening_balances import OpeningBalanceView
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
    AccountViewSet, AccountBalancesView,
    ExpenseCategoryViewSet,
    VendorViewSet,
    ExpenseViewSet,
    BillViewSet,
    OwnerStandingView,
    StudentFeeStatementView,
    InternalTransferView,
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
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'bills', BillViewSet, basename='bill')

urlpatterns = [
    path('account-balances/', AccountBalancesView.as_view(), name='account-balances'),
    path('internal-transfers/', InternalTransferView.as_view(), name='internal-transfers'),
    path('income-receipts/', IncomeReceiptListView.as_view(), name='income-receipts'),
    path('dashboard-summary/', FinanceDashboardSummaryView.as_view(), name='finance-dashboard-summary'),
    path('returning-students/', ReturningStudentsView.as_view(), name='returning-students'),
    path('returning-students/bill/', ReturningStudentsBillView.as_view(), name='returning-students-bill'),
    path('opening-balances/', OpeningBalanceView.as_view(), name='opening-balances'),
    path('awaiting-clearance/', AwaitingClearanceView.as_view(), name='awaiting-clearance'),
    path('awaiting-clearance/<uuid:student_id>/add-item/', ClearanceAddItemView.as_view(), name='clearance-add-item'),
    path('awaiting-clearance/<uuid:student_id>/prepare/', ClearancePrepareView.as_view(), name='clearance-prepare'),
    path('clearance/lines/<str:line_id>/', ClearanceAdjustLineView.as_view(), name='clearance-adjust-line'),
    path('owner-standing/', OwnerStandingView.as_view(), name='owner-standing'),
    path('students/<uuid:student_id>/statement/', StudentFeeStatementView.as_view(), name='student-fee-statement'),
    path('lunch/enrollments/', LunchEnrollmentListCreateView.as_view(), name='lunch-enrollments'),
    path('lunch/enrollments/<uuid:enrollment_id>/', LunchEnrollmentDetailView.as_view(), name='lunch-enrollment-detail'),
    path('lunch/kitty/', LunchKittyView.as_view(), name='lunch-kitty'),
    path('lunch/ensure-defaults/', LunchEnsureDefaultsView.as_view(), name='lunch-ensure-defaults'),
    path('', include(router.urls)),
]
