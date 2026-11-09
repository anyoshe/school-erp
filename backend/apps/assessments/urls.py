from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AssessmentViewSet,
    ClassResultsView,
    ReportCardView,
    ClassReportCardsView,
    MarksMatrixView,
    DefaultAssessmentPlanView,
    PrepareGradeAssessmentsView,
    MarksCsvImportView,
    TranscriptView,
    LearnerProgressView,
    ExamHallViewSet,
    ExamSittingViewSet,
    ExamAllocateSeatsView,
    ExamSeatListView,
)

router = DefaultRouter()
router.register(r"assessments", AssessmentViewSet, basename="assessment")
router.register(r"exam-halls", ExamHallViewSet, basename="exam-hall")
router.register(r"exam-sittings", ExamSittingViewSet, basename="exam-sitting")

urlpatterns = [
    path(
        "marks-import/",
        MarksCsvImportView.as_view(),
        name="marks-csv-import",
    ),
    path(
        "prepare-grade-assessments/",
        PrepareGradeAssessmentsView.as_view(),
        name="prepare-grade-assessments",
    ),
    path("class-results/", ClassResultsView.as_view(), name="class-results"),
    path("report-card/", ReportCardView.as_view(), name="report-card"),
    path("report-cards/", ClassReportCardsView.as_view(), name="report-cards"),
    path("transcript/", TranscriptView.as_view(), name="transcript"),
    path("learner-progress/", LearnerProgressView.as_view(), name="learner-progress"),
    path("marks-matrix/", MarksMatrixView.as_view(), name="marks-matrix"),
    path(
        "assessment-plans/default/",
        DefaultAssessmentPlanView.as_view(),
        name="default-assessment-plan",
    ),
    path(
        "exam-sittings/<uuid:sitting_id>/allocate/",
        ExamAllocateSeatsView.as_view(),
        name="exam-allocate",
    ),
    path(
        "exam-sittings/<uuid:sitting_id>/seats/",
        ExamSeatListView.as_view(),
        name="exam-seats",
    ),
    path("", include(router.urls)),
]
