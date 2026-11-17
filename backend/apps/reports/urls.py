from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet
from . import operational

router = DefaultRouter()
router.register(r'reports', ReportViewSet, basename='reports')

urlpatterns = [
    path('operational/summary/', operational.OperationalSummaryView.as_view()),
    path('operational/enrollment-funnel.csv', operational.EnrollmentFunnelCSVView.as_view()),
    path('operational/arrears.csv', operational.ArrearsCSVView.as_view()),
    path('operational/attendance-summary.csv', operational.AttendanceSummaryCSVView.as_view()),
    path('', include(router.urls)),
]
