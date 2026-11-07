from rest_framework import serializers
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import Staff, Payroll

User = get_user_model()


class StaffSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = Staff
        fields = [
            "id",
            "user",
            "user_email",
            "full_name",
            "first_name",
            "last_name",
            "school",
            "role",
            "role_display",
            "department",
            "job_title",
            "employee_number",
            "phone",
            "hire_date",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        u = obj.user
        name = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip()
        return name or getattr(u, "email", "") or str(obj.id)


class StaffWriteSerializer(serializers.Serializer):
    """Create or update staff; creates a User when creating."""

    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=30)
    role = serializers.ChoiceField(choices=Staff.Role.choices, required=False)
    department = serializers.CharField(required=False, allow_blank=True, max_length=80)
    job_title = serializers.CharField(required=False, allow_blank=True, max_length=80)
    employee_number = serializers.CharField(required=False, allow_blank=True, max_length=40)
    hire_date = serializers.DateField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=255)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    create_login = serializers.BooleanField(required=False, default=True)

    def create(self, validated_data):
        school = self.context["school"]
        request = self.context.get("request")
        email = (validated_data.get("email") or "").strip().lower()
        first_name = (validated_data.get("first_name") or "").strip()
        last_name = (validated_data.get("last_name") or "").strip()
        if not email:
            raise serializers.ValidationError({"email": "Email is required for new staff."})
        if not first_name and not last_name:
            raise serializers.ValidationError(
                {"first_name": "Provide at least a first or last name."}
            )

        role = validated_data.get("role") or Staff.Role.TEACHER
        password = validated_data.get("password") or User.objects.make_random_password(length=12)

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": {
                        Staff.Role.TEACHER: User.Role.TEACHER,
                        Staff.Role.LIBRARIAN: User.Role.LIBRARIAN,
                        Staff.Role.ACCOUNTANT: User.Role.ACCOUNTANT,
                        Staff.Role.PRINCIPAL: User.Role.PRINCIPAL,
                        Staff.Role.ADMIN: User.Role.SCHOOL_ADMIN,
                    }.get(role, User.Role.TEACHER),
                    "is_active": True,
                },
            )
            if not created:
                # Update name if empty
                updates = []
                if first_name and not user.first_name:
                    user.first_name = first_name
                    updates.append("first_name")
                if last_name and not user.last_name:
                    user.last_name = last_name
                    updates.append("last_name")
                if updates:
                    user.save(update_fields=updates)
            else:
                user.set_password(password)
                if first_name:
                    user.first_name = first_name
                if last_name:
                    user.last_name = last_name
                # Map staff role → user role where possible
                if role == Staff.Role.TEACHER and hasattr(User.Role, "TEACHER"):
                    user.role = User.Role.TEACHER
                user.save()

            if hasattr(user, "staff_profile"):
                raise serializers.ValidationError(
                    {"email": "This user already has a staff profile."}
                )

            # Attach user to school membership if M2M exists
            try:
                if school and hasattr(school, "users"):
                    school.users.add(user)
            except Exception:
                pass

            staff = Staff.objects.create(
                user=user,
                school=school,
                role=role,
                department=validated_data.get("department") or "",
                job_title=validated_data.get("job_title") or "",
                employee_number=validated_data.get("employee_number") or "",
                phone=validated_data.get("phone") or "",
                hire_date=validated_data.get("hire_date"),
                is_active=validated_data.get("is_active", True),
                notes=validated_data.get("notes") or "",
            )
        return staff

    def update(self, instance, validated_data):
        user = instance.user
        first_name = validated_data.get("first_name")
        last_name = validated_data.get("last_name")
        email = validated_data.get("email")
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if email:
            email = email.strip().lower()
            if User.objects.exclude(pk=user.pk).filter(email=email).exists():
                raise serializers.ValidationError({"email": "Email already in use."})
            user.email = email
        password = validated_data.get("password")
        if password:
            user.set_password(password)
        user.save()

        for field in (
            "role",
            "department",
            "job_title",
            "employee_number",
            "phone",
            "hire_date",
            "is_active",
            "notes",
        ):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


class PayrollSerializer(serializers.ModelSerializer):
    staff_email = serializers.EmailField(source="staff.user.email", read_only=True)
    staff_role = serializers.CharField(source="staff.role", read_only=True)
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = Payroll
        fields = [
            "id",
            "staff",
            "staff_email",
            "staff_name",
            "staff_role",
            "basic_salary",
            "allowances",
            "deductions",
            "net_salary",
            "month",
        ]

    def get_staff_name(self, obj):
        u = obj.staff.user
        name = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return name or u.email


class PayrollCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payroll
        fields = [
            "id",
            "staff",
            "basic_salary",
            "allowances",
            "deductions",
            "net_salary",
            "month",
        ]
