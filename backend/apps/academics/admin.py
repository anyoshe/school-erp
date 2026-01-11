# apps/academics/admin.py
from django.contrib import admin
from .models import Curriculum, GradeLevel, Department

@admin.register(Curriculum)
class CurriculumAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'short_code', 'is_active')
    list_filter = ('school', 'is_active')
    search_fields = ('name', 'description')


@admin.register(GradeLevel)
class GradeLevelAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'curriculum', 'order')
    list_filter = ('school', 'curriculum')
    search_fields = ('name', 'short_name', 'code')
    ordering = ('order', 'name')


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'curriculum', 'short_name')
    list_filter = ('school', 'curriculum')
    search_fields = ('name', 'short_name', 'code')