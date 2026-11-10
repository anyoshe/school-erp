from django.contrib import admin
from .models import RiskAlert


@admin.register(RiskAlert)
class RiskAlertAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "severity", "status", "school", "updated_at")
    list_filter = ("category", "severity", "status")
    search_fields = ("title", "detail", "fingerprint")
