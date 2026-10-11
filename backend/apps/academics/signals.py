# Add this at the bottom of apps/academics/apps.py (or in signals.py and import it)

def load_initial_templates(sender, **kwargs):
    """Load initial curriculum templates, grade levels, and departments if they don't exist."""
    from django.core.management import call_command
    import os
    from django.conf import settings

    fixture_path = os.path.join(settings.BASE_DIR, 'apps', 'academics', 'fixtures', 'initial_templates.json')

    try:
        # Use loaddata with --ignorenonexistent to be safe if some models change later
        call_command('loaddata', fixture_path, verbosity=0, ignorenonexistent=True)
        print("✅ Initial curriculum templates, grade levels, and departments seeded successfully.")
    except Exception as e:
        # Don't break startup if something goes wrong (e.g. during tests)
        print(f"⚠️  Failed to load initial templates: {e}")