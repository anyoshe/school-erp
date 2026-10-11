# apps/academics/apps.py
from django.apps import AppConfig
from django.db.models.signals import post_migrate
import os
from django.conf import settings


class AcademicsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.academics'
    verbose_name = "Academics"

    def ready(self):
        # Connect signal only when the app is ready
        post_migrate.connect(load_initial_templates, sender=self)


# ─────────────────────────────────────────────────────────────
# Seeding Function
# ─────────────────────────────────────────────────────────────
def load_initial_templates(sender, **kwargs):
    """Automatically load initial curriculum templates, grade levels, and departments after migrate."""
    from django.core.management import call_command

    fixture_path = os.path.join(
        settings.BASE_DIR, 
        'apps', 
        'academics', 
        'fixtures', 
        'initial_templates.json'
    )

    if not os.path.exists(fixture_path):
        print(f"⚠️  Fixture file not found: {fixture_path}")
        return

    try:
        # verbosity=1 so you can see it working
        call_command('loaddata', fixture_path, verbosity=1, ignorenonexistent=True)
        print("✅ Initial curriculum templates, grade levels, and departments seeded successfully.")
    except Exception as e:
        print(f"⚠️  Failed to load initial templates: {e}")