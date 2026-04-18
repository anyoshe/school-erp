from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet,
    GuardianViewSet,
    StudentGuardianViewSet,
    MedicalRecordViewSet,
)

router = DefaultRouter()
router.register(r'guardians', GuardianViewSet, basename='guardian')
router.register(r'', StudentViewSet, basename='student')  # /api/students/

urlpatterns = [
    path('student-guardians/', StudentGuardianViewSet.as_view({'get': 'list'}), name='student-guardian-list'),
    path('medical-records/', MedicalRecordViewSet.as_view({'get': 'list'}), name='medical-record-list'),
    path('', include(router.urls)),
]