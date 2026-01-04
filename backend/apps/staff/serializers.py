from rest_framework import serializers
from .models import Staff, Payroll
from apps.accounts.serializers import UserSerializer

# ----------------------------
# STAFF SERIALIZERS
# ----------------------------

class StaffSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes related user info
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Staff
        fields = [
            'id',
            'user',
            'user_email',
            'role',
            'department',
            'hire_date',
            'created_at',
            'updated_at'
        ]


class StaffCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For adding or editing staff profiles
    """
    class Meta:
        model = Staff
        fields = [
            'id',
            'user',
            'role',
            'department',
            'hire_date'
        ]


# ----------------------------
# PAYROLL SERIALIZERS
# ----------------------------

class PayrollSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes staff info
    """
    staff_email = serializers.EmailField(source='staff.user.email', read_only=True)
    staff_role = serializers.CharField(source='staff.role', read_only=True)

    class Meta:
        model = Payroll
        fields = [
            'id',
            'staff',
            'staff_email',
            'staff_role',
            'basic_salary',
            'allowances',
            'deductions',
            'net_salary',
            'month'
        ]


class PayrollCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For adding or editing payroll records
    """
    class Meta:
        model = Payroll
        fields = [
            'id',
            'staff',
            'basic_salary',
            'allowances',
            'deductions',
            'net_salary',
            'month'
        ]
