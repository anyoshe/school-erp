# apps/academics/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CurriculumViewSet,
    GradeLevelViewSet,
    DepartmentViewSet,
    CurriculumTemplateViewSet,
    CopyCurriculumTemplateAPIView,
    PublicGradeLevelsView,
    SchoolAcademicStatusView,
)

router = DefaultRouter()

# Add explicit basename to ALL registrations (prevents auto-detection failures)
router.register(r'curricula', CurriculumViewSet, basename='curricula')
router.register(r'grade-levels', GradeLevelViewSet, basename='grade-level')
router.register(r'departments', DepartmentViewSet, basename='department')

# Template viewset (already had basename, but keep it consistent)
router.register(
    r'curriculum-templates',
    CurriculumTemplateViewSet,
    basename='curriculum-template'
)

urlpatterns = [
    path('', include(router.urls)),
    path('copy-template/', CopyCurriculumTemplateAPIView.as_view(), name='copy-curriculum-template'),
    path('public/schools/<str:school_id>/grade-levels/', 
         PublicGradeLevelsView.as_view(), 
         name='public-grade-levels'),
    path('public/schools/<str:school_id>/status/', 
         SchoolAcademicStatusView.as_view(), 
         name='school-academic-status'),
]