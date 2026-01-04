from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StaffViewSet, PayrollViewSet

router = DefaultRouter()
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'payroll', PayrollViewSet, basename='payroll')

urlpatterns = [
    path('', include(router.urls)),
]
