from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GuardianViewSet,
    StudentGuardianViewSet,
    MedicalRecordViewSet,
)

router = DefaultRouter()

# ONLY sub-resources here
router.register(r'guardians', GuardianViewSet, basename='guardians')
router.register(r'student-guardians', StudentGuardianViewSet, basename='student-guardians')
router.register(r'medical-records', MedicalRecordViewSet, basename='medical-records')

urlpatterns = [
    path('', include(router.urls)),
]
