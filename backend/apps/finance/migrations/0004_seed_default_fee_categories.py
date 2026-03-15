# # finance/migrations/0004_seed_default_fee_categories.py
# from django.db import migrations

# # These are your original default categories from the frontend
# # Adjust names, is_mandatory, display_order as needed
# DEFAULT_CATEGORIES = [
#     {"name": "Tuition Fees", "is_mandatory": True, "display_order": 10},
#     {"name": "Books & Textbooks", "is_mandatory": True, "display_order": 20},
#     {"name": "Uniforms & Supplies", "is_mandatory": True, "display_order": 30},
#     {"name": "Admission & Registration", "is_mandatory": True, "display_order": 40},
#     {"name": "Boarding / Accommodation", "is_mandatory": True, "display_order": 50},
#     {"name": "Meals & Catering", "is_mandatory": True, "display_order": 60},
#     {"name": "Transport / Bus Fees", "is_mandatory": True, "display_order": 70},
#     {"name": "Medical & Insurance", "is_mandatory": False, "display_order": 80},
#     {"name": "Examination Fees", "is_mandatory": True, "display_order": 90},
#     {"name": "Co-curricular & Activities", "is_mandatory": False, "display_order": 100},
#     {"name": "Miscellaneous / Other", "is_mandatory": False, "display_order": 110},
# ]


# def seed_default_fee_categories(apps, schema_editor):
#     """
#     Creates the standard/default fee categories for every existing school
#     if they don't already exist.
#     Uses get_or_create to make the migration idempotent (safe to re-run).
#     """
#     FeeCategory = apps.get_model("finance", "FeeCategory")
#     School = apps.get_model("school", "School")  # adjust 'school' if your app name is different

#     schools = School.objects.all()
    
#     if not schools.exists():
#         print("No schools found — nothing to seed.")
#         return

#     created_count = 0
#     skipped_count = 0

#     for school in schools:
#         for data in DEFAULT_CATEGORIES:
#             category, created = FeeCategory.objects.get_or_create(
#                 school=school,
#                 name=data["name"],
#                 defaults={
#                     "description": "",  # or add a short description if you want
#                     "is_mandatory": data["is_mandatory"],
#                     "display_order": data["display_order"],
#                 }
#             )
#             if created:
#                 created_count += 1
#             else:
#                 skipped_count += 1

#     print(f"Seed completed: {created_count} new categories created, {skipped_count} already existed.")


# class Migration(migrations.Migration):

#     dependencies = [
#         ('finance', '0003_feestructure_items'),
#     ]

#     operations = [
#         migrations.RunPython(seed_default_fee_categories),
#     ]

# finance/migrations/0004_seed_default_fee_categories.py

from django.db import migrations

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


def seed_default_fee_categories(apps, schema_editor):
    FeeCategory = apps.get_model('finance', 'FeeCategory')
    School = apps.get_model('school', 'School')   # ← change 'school' if your app name is different (e.g. 'schools')

    schools = School.objects.all()
    
    if not schools.exists():
        print("No schools found in the database — no categories seeded.")
        return

    total_created = 0
    total_skipped = 0

    for school in schools:
        print(f"Processing school: {school.name} (ID: {school.id})")
        school_created = 0
        school_skipped = 0

        for data in DEFAULT_CATEGORIES:
            _, created = FeeCategory.objects.get_or_create(
                school=school,
                name=data['name'],
                defaults={
                    'description': '',
                    'is_mandatory': data['is_mandatory'],
                    'display_order': data['display_order'],
                }
            )
            if created:
                school_created += 1
                total_created += 1
            else:
                school_skipped += 1
                total_skipped += 1

        print(f"  → {school_created} created, {school_skipped} already existed")

    print(f"\nMigration finished:")
    print(f"  Total new categories created: {total_created}")
    print(f"  Total categories already present: {total_skipped}")


class Migration(migrations.Migration):
    dependencies = [
        ('finance', '0003_feestructure_items'),
    ]

    operations = [
        migrations.RunPython(seed_default_fee_categories),
    ]