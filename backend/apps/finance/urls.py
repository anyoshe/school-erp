# apps/finance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FeeCategoryViewSet,
    FeeItemViewSet,
)

router = DefaultRouter()
router.register(r'fee-categories', FeeCategoryViewSet, basename='fee-category')
router.register(r'fee-items', FeeItemViewSet, basename='fee-item')

urlpatterns = [
    path('', include(router.urls)),
]