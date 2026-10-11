from django.apps import AppConfig



class SchoolConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.school'  # ✅ full module path


    def ready(self):
        import apps.school.signals  
