# apps/school/admin.py
from django.contrib import admin
from .models import School, Module


class RestrictedAdminSite(admin.AdminSite):
    """Deny Django admin for platform superusers while keeping admin available for trusted staff."""

    def has_permission(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_active", False):
            return False
        if getattr(user, "is_superuser", False):
            return False
        return super().has_permission(request)


admin.site.__class__ = RestrictedAdminSite


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