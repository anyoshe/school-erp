from rest_framework import serializers
from .models import Staff, Payroll


class StaffSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

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
            "department",
            "hire_date",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        u = obj.user
        name = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip()
        return name or getattr(u, "email", "") or str(obj.id)


class StaffCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = [
            "id",
            "school",
            "user",
            "role",
            "department",
            "hire_date",
        ]
        read_only_fields = ["school"]


class PayrollSerializer(serializers.ModelSerializer):
    staff_email = serializers.EmailField(source="staff.user.email", read_only=True)
    staff_role = serializers.CharField(source="staff.role", read_only=True)

    class Meta:
        model = Payroll
        fields = [
            "id",
            "staff",
            "staff_email",
            "staff_role",
            "basic_salary",
            "allowances",
            "deductions",
            "net_salary",
            "month",
        ]


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
