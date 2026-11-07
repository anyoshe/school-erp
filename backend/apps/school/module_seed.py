from django.db import OperationalError, ProgrammingError

from .models import Module


DEFAULT_MODULES = [
    {"name": "Admissions Management", "code": "admissions"},
    {"name": "Student Management", "code": "students"},
    {"name": "Events Management", "code": "events"},
    {"name": "Health & Wellness", "code": "health"},
    {"name": "Parent Portal", "code": "parent_portal"},
    {"name": "Alumni Management", "code": "alumni"},
    {"name": "Transport Management", "code": "transport"},
    {"name": "Academic Management", "code": "academics"},
    {"name": "Attendance Tracking", "code": "attendance"},
    {"name": "E-Learning", "code": "elearning"},
    {"name": "Finance & Accounting", "code": "finance"},
    {"name": "Inventory Management", "code": "inventory"},
    {"name": "Library Management", "code": "library"},
    {"name": "Procurement Management", "code": "procurement"},
    {"name": "Reports & Analytics", "code": "reports"},
    {"name": "Human Resource Management", "code": "staff"},
]


def seed_default_modules():
    """
    Keep the platform module catalogue present.

    This is intentionally idempotent so it can run at startup and before listing
    modules without creating duplicates.
    """
    try:
        for module in DEFAULT_MODULES:
            Module.objects.update_or_create(
                code=module["code"],
                defaults={"name": module["name"]},
            )
    except (OperationalError, ProgrammingError):
        # The database/table may not exist yet during early migrate/check flows.
        return



CORE_MODULE_CODES = (
    "admissions",
    "students",
    "finance",
    "academics",
    "attendance",
    "staff",
    "reports",
)


def ensure_school_core_modules(school):
    """Attach core ERP modules to a school if missing."""
    seed_default_modules()
    try:
        for code in CORE_MODULE_CODES:
            mod = Module.objects.filter(code=code).first()
            if mod and not school.modules.filter(pk=mod.pk).exists():
                school.modules.add(mod)
    except (OperationalError, ProgrammingError):
        return
