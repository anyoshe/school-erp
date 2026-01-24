# admissions/admin.py
from django.contrib import admin
from .models import Application, ApplicationDocument, AdmissionFeePayment

@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'first_name',
        'last_name',
        'status',
        'school',
        'created_by',  # exists in your model
        'submitted_at',  # if you have this field
    )
    list_filter = ('status', 'school', 'gender', 'nationality')
    search_fields = ('first_name', 'last_name', 'primary_guardian_name', 'primary_guardian_phone')
    ordering = ('-id',)  # safe default (or use '-submitted_at' if field exists)

    readonly_fields = ('id', 'created_by')  # only include fields that actually exist

admin.site.register(ApplicationDocument)
admin.site.register(AdmissionFeePayment)