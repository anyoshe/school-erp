from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClassViewSet, SubjectViewSet, ExamViewSet, ResultViewSet

router = DefaultRouter()
router.register(r'classes', ClassViewSet, basename='classes')
router.register(r'subjects', SubjectViewSet, basename='subjects')
router.register(r'exams', ExamViewSet, basename='exams')
router.register(r'results', ResultViewSet, basename='results')

urlpatterns = [
    path('', include(router.urls)),
]
