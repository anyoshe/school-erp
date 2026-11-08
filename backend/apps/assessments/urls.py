from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AssessmentViewSet,
    ClassResultsView,
    ReportCardView,
    ClassReportCardsView,
    MarksMatrixView,
)

router = DefaultRouter()
router.register(r"assessments", AssessmentViewSet, basename="assessment")

urlpatterns = [
    path("class-results/", ClassResultsView.as_view(), name="class-results"),
    path("report-card/", ReportCardView.as_view(), name="report-card"),
    path("report-cards/", ClassReportCardsView.as_view(), name="report-cards"),
    path("marks-matrix/", MarksMatrixView.as_view(), name="marks-matrix"),
    path("", include(router.urls)),
]
