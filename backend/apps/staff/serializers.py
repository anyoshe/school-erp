from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string

from .models import Staff, Payroll, LeaveRequest

User = get_user_model()


class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    employment_type_display = serializers.CharField(
        source="get_employment_type_display", read_only=True
    )

    class Meta:
        model = Staff
        fields = (
            "id",
            "user",
            "school",
            "full_name",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "department",
            "job_title",
            "employee_number",
            "phone",
            "hire_date",
            "exit_date",
            "is_active",
            "notes",
            "employment_type",
            "employment_type_display",
            "gender",
            "national_id",
            "tsc_number",
            "bank_name",
            "bank_account",
            "next_of_kin",
            "next_of_kin_phone",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "user", "school", "created_at", "updated_at")

    def get_full_name(self, obj):
        u = obj.user
        name = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return name or u.email


class StaffWriteSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=30)
    role = serializers.ChoiceField(choices=Staff.Role.choices, required=False)
    department = serializers.CharField(required=False, allow_blank=True, max_length=80)
    job_title = serializers.CharField(required=False, allow_blank=True, max_length=80)
    employee_number = serializers.CharField(required=False, allow_blank=True, max_length=40)
    hire_date = serializers.DateField(required=False, allow_null=True)
    exit_date = serializers.DateField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=255)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    employment_type = serializers.ChoiceField(
        choices=Staff.EmploymentType.choices, required=False
    )
    gender = serializers.ChoiceField(
        choices=Staff.Gender.choices, required=False, allow_blank=True
    )
    national_id = serializers.CharField(required=False, allow_blank=True, max_length=40)
    tsc_number = serializers.CharField(required=False, allow_blank=True, max_length=40)
    bank_name = serializers.CharField(required=False, allow_blank=True, max_length=80)
    bank_account = serializers.CharField(required=False, allow_blank=True, max_length=40)
    next_of_kin = serializers.CharField(required=False, allow_blank=True, max_length=120)
    next_of_kin_phone = serializers.CharField(required=False, allow_blank=True, max_length=30)

    def create(self, validated_data):
        school = self.context["school"]
        email = (validated_data.get("email") or "").strip().lower()
        if not email:
            raise serializers.ValidationError({"email": "Email is required for new staff"})
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists"})

        password = validated_data.get("password") or get_random_string(10)
        role_map = {
            "TEACHER": getattr(User.Role, "TEACHER", "TEACHER"),
            "ACCOUNTANT": getattr(User.Role, "ACCOUNTANT", "ACCOUNTANT"),
            "LIBRARIAN": getattr(User.Role, "LIBRARIAN", "LIBRARIAN"),
            "PRINCIPAL": getattr(User.Role, "PRINCIPAL", "PRINCIPAL"),
            "ADMIN": getattr(User.Role, "SCHOOL_ADMIN", "SCHOOL_ADMIN"),
        }
        staff_role = validated_data.get("role") or Staff.Role.TEACHER
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=validated_data.get("first_name") or "",
            last_name=validated_data.get("last_name") or "",
            role=role_map.get(staff_role, getattr(User.Role, "TEACHER", "TEACHER")),
        )

        staff = Staff.objects.create(
            user=user,
            school=school,
            role=staff_role,
            department=validated_data.get("department") or "",
            job_title=validated_data.get("job_title") or "",
            employee_number=validated_data.get("employee_number") or "",
            phone=validated_data.get("phone") or "",
            hire_date=validated_data.get("hire_date"),
            exit_date=validated_data.get("exit_date"),
            is_active=validated_data.get("is_active", True),
            notes=validated_data.get("notes") or "",
            employment_type=validated_data.get("employment_type") or Staff.EmploymentType.PERMANENT,
            gender=validated_data.get("gender") or "",
            national_id=validated_data.get("national_id") or "",
            tsc_number=validated_data.get("tsc_number") or "",
            bank_name=validated_data.get("bank_name") or "",
            bank_account=validated_data.get("bank_account") or "",
            next_of_kin=validated_data.get("next_of_kin") or "",
            next_of_kin_phone=validated_data.get("next_of_kin_phone") or "",
        )
        if hasattr(school, "users"):
            try:
                school.users.add(user)
            except Exception:
                pass
        return staff

    def update(self, instance, validated_data):
        user = instance.user
        if "first_name" in validated_data:
            user.first_name = validated_data.get("first_name") or ""
        if "last_name" in validated_data:
            user.last_name = validated_data.get("last_name") or ""
        if "email" in validated_data and validated_data.get("email"):
            email = validated_data["email"].strip().lower()
            if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
                raise serializers.ValidationError({"email": "Email already in use"})
            user.email = email
        pwd = validated_data.get("password")
        if pwd:
            user.set_password(pwd)
        user.save()

        for field in (
            "role",
            "department",
            "job_title",
            "employee_number",
            "phone",
            "hire_date",
            "exit_date",
            "is_active",
            "notes",
            "employment_type",
            "gender",
            "national_id",
            "tsc_number",
            "bank_name",
            "bank_account",
            "next_of_kin",
            "next_of_kin_phone",
        ):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


class PayrollSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    staff_role = serializers.CharField(source="staff.role", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payroll
        fields = (
            "id",
            "staff",
            "staff_name",
            "staff_role",
            "basic_salary",
            "allowances",
            "deductions",
            "net_salary",
            "month",
            "status",
            "status_display",
            "paid_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "net_salary", "created_at", "updated_at")

    def get_staff_name(self, obj):
        u = obj.staff.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email


class PayrollCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payroll
        fields = (
            "staff",
            "basic_salary",
            "allowances",
            "deductions",
            "month",
            "status",
            "paid_at",
            "notes",
        )

    def validate(self, attrs):
        basic = attrs.get("basic_salary", getattr(self.instance, "basic_salary", None))
        allow = attrs.get("allowances", getattr(self.instance, "allowances", Decimal("0")))
        ded = attrs.get("deductions", getattr(self.instance, "deductions", Decimal("0")))
        if basic is not None and Decimal(str(basic)) < 0:
            raise serializers.ValidationError({"basic_salary": "Cannot be negative"})
        if Decimal(str(allow or 0)) < 0 or Decimal(str(ded or 0)) < 0:
            raise serializers.ValidationError("Allowances/deductions cannot be negative")
        return attrs


class LeaveRequestSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    leave_type_display = serializers.CharField(source="get_leave_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = (
            "id",
            "school",
            "staff",
            "staff_name",
            "leave_type",
            "leave_type_display",
            "start_date",
            "end_date",
            "days",
            "reason",
            "status",
            "status_display",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "created_at",
        )
        read_only_fields = (
            "id",
            "school",
            "status",
            "reviewed_by",
            "reviewed_at",
            "created_at",
        )

    def get_staff_name(self, obj):
        u = obj.staff.user
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
