from django.urls import path

from .views import (
    RiskAckView,
    RiskDigestPreviewView,
    RiskDigestSendView,
    RiskScanView,
    RiskTodayView,
)

urlpatterns = [
    path("today/", RiskTodayView.as_view(), name="risks-today"),
    path("scan/", RiskScanView.as_view(), name="risks-scan"),
    path("digest/", RiskDigestPreviewView.as_view(), name="risks-digest-preview"),
    path("digest/send/", RiskDigestSendView.as_view(), name="risks-digest-send"),
    path("<uuid:alert_id>/ack/", RiskAckView.as_view(), name="risks-ack"),
]
