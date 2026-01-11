from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchoolViewSet, ModuleViewSet

router = DefaultRouter()
router.register(r'schools', SchoolViewSet, basename='schools')
router.register(r'modules', ModuleViewSet, basename='modules')

urlpatterns = [
    path('', include(router.urls)),
]
