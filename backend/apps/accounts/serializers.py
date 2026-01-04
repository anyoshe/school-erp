from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Permission, UserPermission
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
    """
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'role',
            'is_active',
            'is_staff',
            'created_at',
            'updated_at',
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    """
    WRITE serializer
    Used for:
    - Creating users (staff, parents, students)
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'password',
            'role',
            'is_active',
            'is_staff',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        return user


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
