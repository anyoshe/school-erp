from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"books", views.BookViewSet, basename="library-books")
router.register(r"copies", views.BookCopyViewSet, basename="library-copies")
router.register(r"borrowings", views.BorrowingViewSet, basename="library-borrowings")
router.register(r"acquisitions", views.AcquisitionViewSet, basename="library-acquisitions")
router.register(r"reservations", views.ReservationViewSet, basename="library-reservations")
router.register(r"class-allocations", views.ClassAllocationViewSet, basename="library-class-allocations")
router.register(r"stocktakes", views.StocktakeViewSet, basename="library-stocktakes")
router.register(r"digital", views.DigitalResourceViewSet, basename="library-digital")
router.register(r"assignments", views.ResourceAssignmentViewSet, basename="library-assignments")
router.register(r"progress", views.ReadingProgressViewSet, basename="library-progress")
router.register(r"bookmarks", views.BookmarkViewSet, basename="library-bookmarks")

urlpatterns = [
    path("dashboard/", views.library_dashboard, name="library-dashboard"),
    path("reports/", views.library_reports, name="library-reports"),
    path("digital/<uuid:pk>/file/", views.digital_file, name="library-digital-file"),
    path("digital/<uuid:pk>/progress/", views.digital_progress, name="library-digital-progress"),
    path("settings/", views.library_settings, name="library-settings"),
    path("assignment-monitor/", views.assignment_monitor, name="library-assignment-monitor"),
    path("my-learning/", views.my_learning, name="library-my-learning"),
    path("delegates/", views.library_delegates, name="library-delegates"),
    path("", include(router.urls)),
]
