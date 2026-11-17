"""
Reset a user's password by email (case-insensitive).

  python manage.py set_user_password user@example.com 'NewPass123!'
  python manage.py set_user_password user@example.com --generate
"""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
import secrets
import string

User = get_user_model()


class Command(BaseCommand):
    help = "Set or generate a password for a user by email"

    def add_arguments(self, parser):
        parser.add_argument("email", type=str)
        parser.add_argument("password", nargs="?", default="")
        parser.add_argument(
            "--generate",
            action="store_true",
            help="Generate a random temporary password",
        )
        parser.add_argument(
            "--force-change",
            action="store_true",
            default=True,
            help="Require password change on next login (default on)",
        )

    def handle(self, *args, **options):
        email = (options["email"] or "").strip()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"No user with email matching {email!r}")

        password = (options.get("password") or "").strip()
        if options["generate"] or not password:
            alphabet = string.ascii_letters + string.digits + "!@#$%"
            password = "".join(secrets.choice(alphabet) for _ in range(12))

        user.set_password(password)
        user.force_change_password = bool(options.get("force_change", True))
        user.is_active = True
        user.save(update_fields=["password", "force_change_password", "is_active"])
        self.stdout.write(self.style.SUCCESS(f"Password updated for {user.email}"))
        self.stdout.write(f"Temporary password: {password}")
        self.stdout.write("Share it securely; user should change it after login.")
