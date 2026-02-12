from django.core.management.base import BaseCommand
from apps.accounts.models import Role


class Command(BaseCommand):
    help = "Seed default roles into the database"

    def handle(self, *args, **options):
        roles_data = [
            {"code": "SUPER_ADMIN", "name": "Super Admin / Owner", "description": "Full platform control"},
            {"code": "SCHOOL_ADMIN", "name": "School Administrator", "description": "Manages school settings & users"},
            {"code": "PRINCIPAL", "name": "Principal / Head Teacher", "description": "School leadership"},
            {"code": "DEPUTY_PRINCIPAL", "name": "Deputy Principal / Vice Principal", "description": "Assists principal"},
            {"code": "ADMISSIONS_OFFICER", "name": "Admissions Officer / Registrar", "description": "Handles applications & enrollment"},
            {"code": "ACCOUNTANT", "name": "Accountant / Bursar", "description": "Manages finances"},
            {"code": "ACADEMIC_COORDINATOR", "name": "Academic Coordinator / Head of Section", "description": "Oversees academics"},
            {"code": "TEACHER", "name": "Teacher", "description": "Classroom teaching"},
            {"code": "LIBRARIAN", "name": "Librarian", "description": "Manages library"},
            {"code": "HR_MANAGER", "name": "HR Manager", "description": "Manages staff"},
            {"code": "IT_ADMINISTRATOR", "name": "IT Administrator", "description": "Manages tech infrastructure"},
            {"code": "SECRETARY", "name": "Secretary / Admin Assistant", "description": "Administrative support"},
            {"code": "NURSE", "name": "Nurse / Health Officer", "description": "Health services"},
            {"code": "COUNSELOR", "name": "Counselor", "description": "Student guidance"},
            {"code": "PARENT", "name": "Parent", "description": "Parent portal access"},
            {"code": "STUDENT", "name": "Student", "description": "Student portal access"},
        ]

        created_count = 0
        for role_data in roles_data:
            role, created = Role.objects.get_or_create(
                code=role_data["code"],
                defaults={
                    "name": role_data["name"],
                    "description": role_data["description"],
                }
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"✓ Created role: {role.name}"))
            else:
                self.stdout.write(self.style.WARNING(f"- Role already exists: {role.name}"))

        self.stdout.write(
            self.style.SUCCESS(f"\n✓ Successfully seeded {created_count} new roles!")
        )
