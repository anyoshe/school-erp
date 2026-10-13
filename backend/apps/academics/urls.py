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
    AcademicYearViewSet,
    TermViewSet,
    SectionViewSet,
    StreamViewSet,
    SubjectViewSet,
)

router = DefaultRouter()
router.register(r'curricula', CurriculumViewSet, basename='curricula')
router.register(r'grade-levels', GradeLevelViewSet, basename='grade-level')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'curriculum-templates', CurriculumTemplateViewSet, basename='curriculum-template')
router.register(r'academic-years', AcademicYearViewSet, basename='academic-year')
router.register(r'terms', TermViewSet, basename='term')
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'streams', StreamViewSet, basename='stream')
router.register(r'subjects', SubjectViewSet, basename='subject')

urlpatterns = [
    path('copy-template/', CopyCurriculumTemplateAPIView.as_view(), name='copy-curriculum-template'),
    path('public/schools/<str:school_id>/grade-levels/', PublicGradeLevelsView.as_view(), name='public-grade-levels'),
    path('public/schools/<str:school_id>/status/', SchoolAcademicStatusView.as_view(), name='school-academic-status'),
    path('', include(router.urls)),
]
