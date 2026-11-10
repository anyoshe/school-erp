from django.urls import path

from .views import RiskAckView, RiskScanView, RiskTodayView

urlpatterns = [
    path("today/", RiskTodayView.as_view(), name="risks-today"),
    path("scan/", RiskScanView.as_view(), name="risks-scan"),
    path("<uuid:alert_id>/ack/", RiskAckView.as_view(), name="risks-ack"),
]
