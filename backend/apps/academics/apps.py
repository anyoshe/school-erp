# from django.apps import AppConfig


# class AcademicsConfig(AppConfig):
#     name = 'academics'

from django.apps import AppConfig

class AcademicsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.academics'  # ✅ full module path
