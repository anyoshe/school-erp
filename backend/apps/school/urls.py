from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchoolViewSet, ModuleViewSet
from .views_public import PublicSchoolDetailView  # ✅ correct import

router = DefaultRouter()
router.register(r'schools', SchoolViewSet, basename='schools')
router.register(r'modules', ModuleViewSet, basename='modules')

urlpatterns = [
    # 🔓 Public endpoint
    path(
        "public/schools/<slug:slug>/",
        PublicSchoolDetailView.as_view(),
        name="public-school-detail",
    ),

    # 🔐 Private / admin endpoints
    path("", include(router.urls)),
]
