from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttendanceViewSet,
    StudentAttendanceViewSet,
    ClassAttendanceSheetView,
    AttendanceSummaryView,
)

router = DefaultRouter()
router.register(r"records", AttendanceViewSet, basename="attendance")
router.register(r"students", StudentAttendanceViewSet, basename="student-attendance")

urlpatterns = [
    path("sheet/", ClassAttendanceSheetView.as_view(), name="attendance-sheet"),
    path("summary/", AttendanceSummaryView.as_view(), name="attendance-summary"),
    path("", include(router.urls)),
]
