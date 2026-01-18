from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet,
    GuardianViewSet,
    StudentGuardianViewSet,
    MedicalRecordViewSet,
)

router = DefaultRouter()
router.register(r'', StudentViewSet, basename='student')  # /api/students/
router.register(r'guardians', GuardianViewSet, basename='guardian')
router.register(r'student-guardians', StudentGuardianViewSet, basename='student-guardian')
router.register(r'medical-records', MedicalRecordViewSet, basename='medical-record')

urlpatterns = [
    path('', include(router.urls)),
]