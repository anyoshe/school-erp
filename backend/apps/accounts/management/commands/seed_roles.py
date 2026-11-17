"""
Seed system roles and default module access maps.

Usage:
  python manage.py seed_roles
  python manage.py seed_roles --sync-modules
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import Role
from apps.school.models import Module
from apps.school.module_seed import seed_default_modules


# Module codes each role may access by default (union when multi-role)
ROLE_MODULE_MAP = {
    "SUPER_ADMIN": None,  # all
    "SCHOOL_ADMIN": None,
    "PRINCIPAL": None,
    "DEPUTY_PRINCIPAL": None,
    "MANAGER": [
        "admissions",
        "students",
        "finance",
        "academics",
        "attendance",
        "staff",
        "library",
        "transport",
        "reports",
        "parent_portal",
    ],
    "ADMISSIONS_OFFICER": ["admissions", "students", "parent_portal", "reports"],
    "ACCOUNTANT": ["finance", "students", "reports", "transport"],
    "BURSAR": ["finance", "students", "reports", "transport"],
    "ACADEMIC_COORDINATOR": [
        "academics",
        "students",
        "attendance",
        "reports",
        "library",
    ],
    "TEACHER": ["academics", "students", "attendance", "library"],
    "LIBRARIAN": ["library", "students"],
    "SECRETARY": [
        "admissions",
        "students",
        "attendance",
        "parent_portal",
        "transport",
    ],
    "HR_MANAGER": ["staff", "reports"],
    "PARENT": ["parent_portal"],
    "STUDENT": ["library", "academics"],  # digital shelf / limited academics
    "IT_ADMINISTRATOR": None,
    "NURSE": ["students", "health"],
    "COUNSELOR": ["students", "academics", "parent_portal"],
}

ROLES_DATA = [
    {"code": "SUPER_ADMIN", "name": "Super Admin / Owner", "description": "Platform owner"},
    {"code": "SCHOOL_ADMIN", "name": "School Administrator", "description": "Full school settings & users"},
    {"code": "PRINCIPAL", "name": "Principal / Head Teacher", "description": "School leadership"},
    {"code": "DEPUTY_PRINCIPAL", "name": "Deputy Principal", "description": "Assists principal"},
    {"code": "MANAGER", "name": "School Manager", "description": "Operational manager across modules"},
    {"code": "ADMISSIONS_OFFICER", "name": "Admissions Officer / Registrar", "description": "Applications & enrollment"},
    {"code": "ACCOUNTANT", "name": "Accountant", "description": "Finance & fees"},
    {"code": "BURSAR", "name": "Bursar", "description": "Fee collection & finance"},
    {"code": "ACADEMIC_COORDINATOR", "name": "Academic Coordinator", "description": "Academics oversight"},
    {"code": "TEACHER", "name": "Teacher", "description": "Teaching, marks, attendance"},
    {"code": "LIBRARIAN", "name": "Librarian", "description": "Library"},
    {"code": "SECRETARY", "name": "Secretary / Admin Assistant", "description": "Front office support"},
    {"code": "HR_MANAGER", "name": "HR Manager", "description": "Staff & payroll"},
    {"code": "PARENT", "name": "Parent", "description": "Parent portal"},
    {"code": "STUDENT", "name": "Student", "description": "Learner access"},
    {"code": "IT_ADMINISTRATOR", "name": "IT Administrator", "description": "Technical admin"},
    {"code": "NURSE", "name": "Nurse / Health Officer", "description": "Health"},
    {"code": "COUNSELOR", "name": "Counselor", "description": "Guidance"},
]


class Command(BaseCommand):
    help = "Seed roles and optionally sync default module maps"

    def add_arguments(self, parser):
        parser.add_argument(
            "--sync-modules",
            action="store_true",
            help="Attach default modules to each role (additive)",
        )

    def handle(self, *args, **options):
        seed_default_modules()
        created = 0
        for data in ROLES_DATA:
            role, was_created = Role.objects.get_or_create(
                code=data["code"],
                defaults={
                    "name": data["name"],
                    "description": data["description"],
                },
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"Created {role.code}"))
            else:
                # keep name/description refreshed lightly
                Role.objects.filter(pk=role.pk).update(
                    name=data["name"], description=data["description"]
                )

        if options["sync_modules"]:
            modules_by_code = {m.code: m for m in Module.objects.all()}
            for code, mod_list in ROLE_MODULE_MAP.items():
                role = Role.objects.filter(code=code).first()
                if not role:
                    continue
                if mod_list is None:
                    # all known product modules
                    role.modules.set(Module.objects.exclude(
                        code__in=[
                            "events",
                            "health",
                            "alumni",
                            "elearning",
                            "inventory",
                            "procurement",
                        ]
                    ))
                    self.stdout.write(f"{code}: all core modules")
                    continue
                ids = []
                for mc in mod_list:
                    m = modules_by_code.get(mc)
                    if m:
                        ids.append(m.id)
                role.modules.set(ids)
                self.stdout.write(f"{code}: {len(ids)} modules")

        self.stdout.write(self.style.SUCCESS(f"Done. new_roles={created}"))
