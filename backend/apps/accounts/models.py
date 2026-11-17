import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.contrib.auth.models import Group, Permission as AuthPermission

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email).strip().lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', User.Role.SUPER_ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        SUPER_ADMIN          = "SUPER_ADMIN",          "Super Admin / Owner"
        SCHOOL_ADMIN         = "SCHOOL_ADMIN",         "School Administrator"
        PRINCIPAL            = "PRINCIPAL",            "Principal / Head Teacher"
        DEPUTY_PRINCIPAL     = "DEPUTY_PRINCIPAL",     "Deputy Principal / Vice Principal"
        MANAGER              = "MANAGER",              "School Manager"
        ADMISSIONS_OFFICER   = "ADMISSIONS_OFFICER",   "Admissions Officer / Registrar"
        ACCOUNTANT           = "ACCOUNTANT",           "Accountant / Bursar"
        BURSAR               = "BURSAR",               "Bursar"
        ACADEMIC_COORDINATOR = "ACADEMIC_COORDINATOR", "Academic Coordinator / Head of Section"
        TEACHER              = "TEACHER",              "Teacher"
        LIBRARIAN            = "LIBRARIAN",            "Librarian"
        SECRETARY            = "SECRETARY",            "Secretary / Admin Assistant"
        HR_MANAGER           = "HR_MANAGER",           "HR Manager"
        PARENT               = "PARENT",               "Parent"
        STUDENT              = "STUDENT",              "Student"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.SUPER_ADMIN,
        help_text="Primary role (legacy / login default). Prefer assigned roles M2M for multi-role.",
    )
    # Multi-role: teacher can also be librarian, manager, etc.
    roles = models.ManyToManyField(
        "Role",
        blank=True,
        related_name="assigned_users",
        help_text="All roles granted to this user (union of module access).",
    )
    # Extra modules beyond role defaults (grant more access)
    extra_modules = models.ManyToManyField(
        "school.Module",
        blank=True,
        related_name="users_with_extra_access",
        help_text="Additional modules granted on top of role defaults.",
    )
    password_changed_at = models.DateTimeField(null=True, blank=True)
    force_change_password = models.BooleanField(default=False, help_text="User must change password on next login")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Override groups and user_permissions to avoid clashes
    groups = models.ManyToManyField(
        Group,
        related_name="custom_user_set",
        blank=True,
        help_text="The groups this user belongs to.",
        verbose_name="groups"
    )
    user_permissions = models.ManyToManyField(
        AuthPermission,
        related_name="custom_user_permissions_set",
        blank=True,
        help_text="Specific permissions for this user.",
        verbose_name="user permissions"
    )

    def get_role_codes(self):
        """Primary role + all assigned Role codes."""
        codes = set()
        primary = (self.role or "").strip().upper()
        if primary:
            codes.add(primary)
        try:
            codes.update(
                c.upper() for c in self.roles.values_list("code", flat=True) if c
            )
        except Exception:
            pass
        return codes

    def get_effective_module_codes(self, school=None):
        """
        Union of modules from all roles + extra_modules.
        Super/school admin/principal: all modules on the school (or unrestricted).
        """
        codes = self.get_role_codes()
        elevated = {
            "SUPER_ADMIN",
            "SCHOOL_ADMIN",
            "PRINCIPAL",
            "DEPUTY_PRINCIPAL",
            "MANAGER",
        }
        if self.is_superuser or (codes & elevated):
            if school is not None:
                try:
                    return set(school.modules.values_list("code", flat=True))
                except Exception:
                    return set()
            return None  # unrestricted

        mod_codes = set()
        try:
            for role in self.roles.prefetch_related("modules").all():
                mod_codes.update(role.modules.values_list("code", flat=True))
        except Exception:
            pass
        # Primary role code → Role row modules
        if primary := (self.role or "").strip().upper():
            try:
                from apps.accounts.models import Role as RoleModel
                r = RoleModel.objects.filter(code__iexact=primary).prefetch_related("modules").first()
                if r:
                    mod_codes.update(r.modules.values_list("code", flat=True))
            except Exception:
                pass
        try:
            mod_codes.update(self.extra_modules.values_list("code", flat=True))
        except Exception:
            pass

        # Pure parent accounts: parent portal only (no staff modules)
        primary = (self.role or "").strip().upper()
        staffish = {
            "SUPER_ADMIN",
            "SCHOOL_ADMIN",
            "PRINCIPAL",
            "DEPUTY_PRINCIPAL",
            "MANAGER",
            "TEACHER",
            "LIBRARIAN",
            "ACCOUNTANT",
            "BURSAR",
            "SECRETARY",
            "ADMISSIONS_OFFICER",
            "ACADEMIC_COORDINATOR",
            "HR_MANAGER",
        }
        if primary == "PARENT" and not (codes & staffish):
            return {"parent_portal"}
        if codes == {"PARENT"} or codes <= {"PARENT"}:
            return {"parent_portal"}

        return mod_codes

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.code_name


class UserPermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'permission')

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email


# ───────────────────────────────────────────────
# Dynamic Role model for Roles & Permissions tab
# ───────────────────────────────────────────────
class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    # ── This is the key line ──
    modules = models.ManyToManyField('school.Module', related_name='roles', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"