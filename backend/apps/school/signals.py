# school/signals.py  (create the file if it doesn't exist)

from django.db.models.signals import post_migrate, post_save
from django.dispatch import receiver
from apps.school.models import School
from apps.school.module_seed import seed_default_modules
from apps.finance.models import FeeCategory


DEFAULT_CATEGORIES = [
    {"name": "Tuition Fees",          "is_mandatory": True,  "display_order": 10},
    {"name": "Books & Textbooks",     "is_mandatory": True,  "display_order": 20},
    {"name": "Uniforms & Supplies",   "is_mandatory": True,  "display_order": 30},
    {"name": "Admission & Registration", "is_mandatory": True, "display_order": 40},
    {"name": "Boarding / Accommodation", "is_mandatory": True, "display_order": 50},
    {"name": "Meals & Catering",      "is_mandatory": True,  "display_order": 60},
    {"name": "Transport / Bus Fees",  "is_mandatory": True,  "display_order": 70},
    {"name": "Medical & Insurance",   "is_mandatory": False, "display_order": 80},
    {"name": "Examination Fees",      "is_mandatory": True,  "display_order": 90},
    {"name": "Co-curricular & Activities", "is_mandatory": False, "display_order": 100},
    {"name": "Miscellaneous / Other", "is_mandatory": False, "display_order": 110},
]


@receiver(post_save, sender=School)
def seed_default_categories_for_new_school(sender, instance, created, **kwargs):
    if not created:
        return  # only for newly created schools

    print(f"Seeding default fee categories for new school: {instance.name}")

    for data in DEFAULT_CATEGORIES:
        FeeCategory.objects.get_or_create(
            school=instance,
            name=data["name"],
            defaults={
                "description": "",
                "is_mandatory": data["is_mandatory"],
                "display_order": data["display_order"],
            }
        )


@receiver(post_migrate)
def seed_default_modules_after_migrate(sender, **kwargs):
    if sender.name == "apps.school":
        seed_default_modules()
