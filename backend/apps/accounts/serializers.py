from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Role, Permission, UserPermission
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from apps.school.models import School, Module  # adjust import path if needed

User = get_user_model()
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        return token

    def validate(self, attrs):
        attrs['username'] = attrs.get('email')  # map email to username
        return super().validate(attrs)


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

    class Meta:
        model = User
        fields = [
            'id',
            'first_name',          
            'last_name',
            'email',
            'role',
            'full_name',
            'is_active',
            'is_staff',
            'created_at',
            'updated_at',
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email

# class UserCreateSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(write_only=True, required=False)  # ← now optional
#     temporary_password = serializers.SerializerMethodField(read_only=True)

#     class Meta:
#         model = User
#         fields = ['id', 'email', 'password', 'role', 'first_name', 'last_name', 'is_active', 'is_staff', 'temporary_password']

#     def create(self, validated_data):
#         password = validated_data.pop('password', None)
        
#         if not password:
#             # Generate secure temporary password (e.g. 12 chars)
#             import secrets
#             import string
#             alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
#             password = ''.join(secrets.choice(alphabet) for i in range(12))

#         user = User.objects.create_user(
#             email=validated_data['email'],
#             password=password,
#             force_change_password=True,  # ← Mark for first-time password change
#             **{k: v for k, v in validated_data.items() if k != 'email'}
#         )

#         # Store the temp password both on user and in serializer context
#         user._temporary_password = password  # temporary attribute – not saved
#         self.context['temporary_password'] = password
#         return user

#     def get_temporary_password(self, obj):
#         """Return the temporary password"""
#         # Try to get from object first (during initial serialization)
#         if hasattr(obj, '_temporary_password'):
#             return obj._temporary_password
#         # Fall back to context (during re-serialization)
#         return self.context.get('temporary_password', None)
class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    temporary_password = serializers.CharField(read_only=True, allow_null=True)  # ← add this

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'role', 'first_name', 'last_name',
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

        user = User.objects.create_user(
            email=validated_data.pop('email'),
            password=password,
            force_change_password=True,
            **validated_data
        )

        user._temporary_password = password  # temporary attribute
        print("DEBUG: Set _temporary_password on user instance:", hasattr(user, '_temporary_password'))  # ← add
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
    - Updating user role
    - Activating / deactivating users
    """
    class Meta:
        model = User
        fields = [
            'email',
            'role',
            'is_active',
            'is_staff',
        ]


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
    is_temporary_password = serializers.BooleanField(read_only=True)
    force_change_password = serializers.BooleanField(read_only=True)


    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "schools",
            "role",           # the code, e.g. "ADMISSIONS_OFFICER"
            "role_display",   # the nice name, e.g. "Admissions Officer / Registrar"
            "is_temporary_password",
            "force_change_password",  # ← Add this
        ]

    def get_full_name(self, obj):
        if hasattr(obj, 'full_name') and obj.full_name:
            return obj.full_name
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.email.split('@')[0]

    def get_schools(self, obj):
        from apps.school.serializers import SchoolMiniSerializer
        schools_qs = obj.schools.prefetch_related('modules').all()
        return SchoolMiniSerializer(schools_qs, many=True).data
    
    def get_is_temporary_password(self, obj):
        return obj.password_changed_at is None
    

class RoleSerializer(serializers.ModelSerializer):
    module_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Module.objects.all(),
        source='modules',          # maps to the model field
        required=False
    )

    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'module_ids']
        read_only_fields = ['id']  # optional