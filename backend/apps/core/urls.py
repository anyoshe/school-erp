from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuditLogViewSet, SyncQueueViewSet

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-logs')
router.register(r'sync-queue', SyncQueueViewSet, basename='sync-queue')

urlpatterns = [
    path('', include(router.urls)),
]
