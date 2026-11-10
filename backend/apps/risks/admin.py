from django.contrib import admin
from .models import RiskAlert, RiskDigestLog, SchoolRiskSettings


@admin.register(RiskAlert)
class RiskAlertAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "severity", "status", "school", "updated_at")
    list_filter = ("category", "severity", "status")
    search_fields = ("title", "detail", "fingerprint")


@admin.register(RiskDigestLog)
class RiskDigestLogAdmin(admin.ModelAdmin):
    list_display = ("school", "digest_date", "channel", "alert_count", "high_count", "ok", "created_at")
    list_filter = ("channel", "ok")


@admin.register(SchoolRiskSettings)
class SchoolRiskSettingsAdmin(admin.ModelAdmin):
    list_display = ("school", "enable_fee", "enable_attendance", "enable_academic", "enable_ops", "digest_channel", "updated_at")
