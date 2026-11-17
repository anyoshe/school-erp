from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Role, Permission, UserPermission
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from apps.school.models import School, Module  # adjust import path if needed

User = get_user_model()


def apply_user_roles_and_modules(user, role_codes=None, extra_module_ids=None, primary_role=None):
    """Assign multi-roles and optional extra modules; sync primary role field."""
    from apps.accounts.models import Role
    from apps.school.models import Module

    codes = []
    if role_codes is not None:
        if isinstance(role_codes, str):
            codes = [c.strip().upper() for c in role_codes.split(",") if c.strip()]
        else:
            codes = [str(c).strip().upper() for c in role_codes if str(c).strip()]
    if primary_role and str(primary_role).strip().upper() not in codes:
        codes.insert(0, str(primary_role).strip().upper())
    if not codes and user.role:
        codes = [user.role]

    role_objs = list(Role.objects.filter(code__in=codes))
    if role_codes is not None or primary_role:
        user.roles.set(role_objs)
        if codes:
            user.role = codes[0]
            user.save(update_fields=["role"])

    if extra_module_ids is not None:
        ids = []
        for x in extra_module_ids:
            try:
                ids.append(int(x))
            except (TypeError, ValueError):
                continue
        user.extra_modules.set(Module.objects.filter(pk__in=ids))
    return user

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        try:
            token['roles'] = sorted(user.get_role_codes())
        except Exception:
            token['roles'] = [user.role] if user.role else []
        return token

    def validate(self, attrs):
        # Accept either email or username; normalize email case for parent logins
        raw = (attrs.get("email") or attrs.get("username") or "").strip()
        if self.username_field == "email":
            # Resolve case-insensitive email → canonical username field
            if raw:
                match = User.objects.filter(email__iexact=raw).first()
                attrs["email"] = match.email if match else raw
                attrs["username"] = attrs["email"]
            else:
                attrs["username"] = attrs.get("email") or attrs.get("username")
        else:
            attrs[self.username_field] = attrs.get(self.username_field) or attrs.get("username") or raw
        data = super().validate(attrs)
        user = self.user
        if not getattr(user, "is_active", True):
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed("This account is inactive. Contact the school office.")
        return data


# =========================
# USER SERIALIZERS
# =========================

class UserSerializer(serializers.ModelSerializer):
    """
    READ-ONLY serializer
    Used for:
    - Listing users
    - Viewing profiles
    - Dashboards
    - now includes first_name & last_name
    """
    full_name = serializers.SerializerMethodField()
    role_codes = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    module_codes = serializers.SerializerMethodField()
    extra_module_ids = serializers.SerializerMethodField()
    # Nested shape for legacy frontend: { code, name }
    role_obj = serializers.SerializerMethodField(method_name="get_role_obj")

    class Meta:
        model = User
        fields = [
            'id',
            'first_name',
            'last_name',
            'email',
            'role',
            'role_obj',
            'role_codes',
            'roles',
            'module_codes',
            'extra_module_ids',
            'full_name',
            'is_active',
            'is_staff',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'role': {'required': False},
        }

    def get_role_obj(self, obj):
        code = obj.role or ""
        try:
            from apps.accounts.models import Role
            r = Role.objects.filter(code__iexact=code).first()
            if r:
                return {"code": r.code, "name": r.name}
        except Exception:
            pass
        return {"code": code, "name": code}

    def get_role_codes(self, obj):
        try:
            return sorted(obj.get_role_codes())
        except Exception:
            return [obj.role] if obj.role else []

    def get_roles(self, obj):
        try:
            rows = list(obj.roles.all())
            if not rows and obj.role:
                from apps.accounts.models import Role
                r = Role.objects.filter(code__iexact=obj.role).first()
                if r:
                    rows = [r]
            return [{"id": str(r.id), "code": r.code, "name": r.name} for r in rows]
        except Exception:
            return []

    def get_module_codes(self, obj):
        request = self.context.get("request")
        school = None
        if request is not None:
            try:
                from apps.school.support import selected_school
                school = selected_school(request)
            except Exception:
                school = None
        try:
            codes = obj.get_effective_module_codes(school=school)
            if codes is None:
                return ["*"]
            return sorted(codes)
        except Exception:
            return []

    def get_extra_module_ids(self, obj):
        try:
            return list(obj.extra_modules.values_list("id", flat=True))
        except Exception:
            return []

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Frontend expects role as object {code, name}
        data["role"] = self.get_role_obj(instance)
        data.pop("role_obj", None)
        return data

class UserCreateSerializer(serializers.ModelSerializer):
    role_codes = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True, allow_empty=True
    )
    extra_module_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True, allow_empty=True
    )

    password = serializers.CharField(write_only=True, required=False)
    temporary_password = serializers.CharField(read_only=True, allow_null=True)  # ← add this

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'role', 'role_codes', 'extra_module_ids', 'first_name', 'last_name',
            'is_active', 'is_staff', 'temporary_password'
        ]

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        
        if not password:
            import secrets
            import string
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            password = ''.join(secrets.choice(alphabet) for _ in range(12))
            print("DEBUG: Generated temporary password:", password)
        else:
            print("DEBUG: Password was provided, not generating temp one")

        role_codes = validated_data.pop('role_codes', None)
        extra_module_ids = validated_data.pop('extra_module_ids', None)
        # role may be primary
        primary = validated_data.get('role')

        user = User.objects.create_user(
            email=validated_data.pop('email'),
            password=password,
            force_change_password=True,
            **validated_data
        )

        apply_user_roles_and_modules(
            user,
            role_codes=role_codes,
            extra_module_ids=extra_module_ids,
            primary_role=primary,
        )

        user._temporary_password = password  # temporary attribute
        print("DEBUG: Set _temporary_password on user instance:", hasattr(user, '_temporary_password'))
        return user

    def to_representation(self, instance):
        # This is called when serializing the response
        ret = super().to_representation(instance)
        # Attach the temp password if it exists
        if hasattr(instance, '_temporary_password'):
            ret['temporary_password'] = instance._temporary_password
        return ret
class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Used for:
    - Updating user role(s)
    - Activating / deactivating users
    - Extra module grants
    """
    role_codes = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True, allow_empty=True
    )
    extra_module_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True, allow_empty=True
    )
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'email',
            'role',
            'role_codes',
            'extra_module_ids',
            'first_name',
            'last_name',
            'is_active',
            'is_staff',
        ]

    def update(self, instance, validated_data):
        role_codes = validated_data.pop('role_codes', None)
        extra_module_ids = validated_data.pop('extra_module_ids', None)
        primary = validated_data.get('role', instance.role)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        apply_user_roles_and_modules(
            instance,
            role_codes=role_codes,
            extra_module_ids=extra_module_ids,
            primary_role=primary if role_codes is not None else None,
        )
        if role_codes is None and 'role' in validated_data:
            # single primary role change — ensure M2M includes it
            apply_user_roles_and_modules(
                instance,
                role_codes=[validated_data['role']],
                primary_role=validated_data['role'],
            )
        return instance


# =========================
# PERMISSIONS
# =========================

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            'id',
            'code_name',
            'description',
        ]


class UserPermissionSerializer(serializers.ModelSerializer):
    """
    Assign permissions to users
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)
    permission_code = serializers.CharField(source='permission.code_name', read_only=True)

    class Meta:
        model = UserPermission
        fields = [
            'id',
            'user',
            'user_email',
            'permission',
            'permission_code',
        ]


class CurrentUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    schools   = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    role_codes = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    module_codes = serializers.SerializerMethodField()
    extra_module_ids = serializers.SerializerMethodField()
    is_temporary_password = serializers.BooleanField(read_only=True)
    force_change_password = serializers.BooleanField(read_only=True)


    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "schools",
            "is_superuser",
            "role",
            "role_display",
            "role_codes",
            "roles",
            "module_codes",
            "extra_module_ids",
            "is_temporary_password",
            "force_change_password",
        ]

    def get_role_obj(self, obj):
        code = obj.role or ""
        try:
            from apps.accounts.models import Role
            r = Role.objects.filter(code__iexact=code).first()
            if r:
                return {"code": r.code, "name": r.name}
        except Exception:
            pass
        return {"code": code, "name": code}

    def get_role_codes(self, obj):
        try:
            return sorted(obj.get_role_codes())
        except Exception:
            return [obj.role] if obj.role else []

    def get_roles(self, obj):
        try:
            rows = list(obj.roles.all())
            if not rows and obj.role:
                from apps.accounts.models import Role
                r = Role.objects.filter(code__iexact=obj.role).first()
                if r:
                    rows = [r]
            return [{"id": str(r.id), "code": r.code, "name": r.name} for r in rows]
        except Exception:
            return []

    def get_module_codes(self, obj):
        request = self.context.get("request")
        school = None
        if request is not None:
            try:
                from apps.school.support import selected_school
                school = selected_school(request)
            except Exception:
                school = None
        try:
            codes = obj.get_effective_module_codes(school=school)
            if codes is None:
                return ["*"]
            return sorted(codes)
        except Exception:
            return []

    def get_extra_module_ids(self, obj):
        try:
            return list(obj.extra_modules.values_list("id", flat=True))
        except Exception:
            return []

    def get_full_name(self, obj):

        if hasattr(obj, 'full_name') and obj.full_name:
            return obj.full_name
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.email.split('@')[0]

    def get_schools(self, obj):
        # Session serializer includes modules (code/name) without grade_levels — enough for shell
        from apps.school.serializers import SchoolSessionSerializer
        from apps.school.models import School
        schools_qs = list(obj.schools.prefetch_related("modules").all())
        if (getattr(obj, "role", "") or "").upper() == "PARENT" and not schools_qs:
            try:
                from apps.parent_portal.models import GuardianProfile, ParentStudentLink
                ids = set(
                    GuardianProfile.objects.filter(user=obj).values_list("school_id", flat=True)
                ) | set(
                    ParentStudentLink.objects.filter(guardian_profile__user=obj).values_list(
                        "school_id", flat=True
                    )
                )
                ids = {i for i in ids if i}
                if ids:
                    schools_qs = list(School.objects.filter(pk__in=ids).prefetch_related("modules"))
                    for sch in schools_qs:
                        try:
                            sch.users.add(obj)
                        except Exception:
                            pass
            except Exception:
                pass
        return SchoolSessionSerializer(schools_qs, many=True, context=self.context).data
    
    def get_is_temporary_password(self, obj):
        return obj.password_changed_at is None
    

class RoleSerializer(serializers.ModelSerializer):
    module_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Module.objects.all(),
        source="modules",
        required=False,
    )
    module_codes = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Role
        fields = [
            "id",
            "code",
            "name",
            "description",
            "module_ids",
            "module_codes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "module_codes"]

    def get_module_codes(self, obj):
        try:
            return list(obj.modules.values_list("code", flat=True))
        except Exception:
            return []

    def create(self, validated_data):
        modules = validated_data.pop("modules", [])
        code = (validated_data.get("code") or "").strip().upper()
        if not code:
            # derive from name
            name = validated_data.get("name") or "ROLE"
            code = "".join(ch if ch.isalnum() else "_" for ch in name.upper())[:50]
            validated_data["code"] = code
        else:
            validated_data["code"] = code
        role = Role.objects.create(**validated_data)
        if modules:
            role.modules.set(modules)
        return role

    def update(self, instance, validated_data):
        modules = validated_data.pop("modules", None)
        if "code" in validated_data and validated_data["code"]:
            validated_data["code"] = str(validated_data["code"]).strip().upper()
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if modules is not None:
            instance.modules.set(modules)
        return instance

