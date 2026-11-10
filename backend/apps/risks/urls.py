from django.urls import path

from .views import (
    RiskAckView,
    RiskDigestPreviewView,
    RiskDigestSendView,
    RiskListView,
    RiskReopenView,
    RiskResolveView,
    RiskScanView,
    RiskSettingsView,
    RiskTodayView,
)

urlpatterns = [
    path("today/", RiskTodayView.as_view(), name="risks-today"),
    path("alerts/", RiskListView.as_view(), name="risks-list"),
    path("scan/", RiskScanView.as_view(), name="risks-scan"),
    path("settings/", RiskSettingsView.as_view(), name="risks-settings"),
    path("digest/", RiskDigestPreviewView.as_view(), name="risks-digest-preview"),
    path("digest/send/", RiskDigestSendView.as_view(), name="risks-digest-send"),
    path("<uuid:alert_id>/ack/", RiskAckView.as_view(), name="risks-ack"),
    path("<uuid:alert_id>/resolve/", RiskResolveView.as_view(), name="risks-resolve"),
    path("<uuid:alert_id>/reopen/", RiskReopenView.as_view(), name="risks-reopen"),
]
