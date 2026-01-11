# apps/school/admin.py
from django.contrib import admin
from .models import School, Module

@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')
    search_fields = ('name', 'code')


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'country', 'currency', 'setup_complete')
    list_filter = ('country', 'currency', 'modules')
    search_fields = ('name', 'short_name', 'email')
    filter_horizontal = ('modules', 'users')  # Nice UI for ManyToMany