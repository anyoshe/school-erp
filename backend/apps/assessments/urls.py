from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AssessmentViewSet, ClassResultsView

router = DefaultRouter()
router.register(r"assessments", AssessmentViewSet, basename="assessment")

urlpatterns = [
    path("class-results/", ClassResultsView.as_view(), name="class-results"),
    path("", include(router.urls)),
]
