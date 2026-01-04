from rest_framework import serializers
from .models import FeeStructure, StudentLedger, Payment
from apps.students.serializers import StudentSerializer
from apps.academics.serializers import ClassSerializer

# ----------------------------
# FEE STRUCTURE SERIALIZERS
# ----------------------------

class FeeStructureSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes class info
    """
    class_name = serializers.CharField(source='class_fk.name', read_only=True)

    class Meta:
        model = FeeStructure
        fields = [
            'id',
            'class_fk',
            'class_name',
            'term',
            'amount'
        ]


class FeeStructureCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For admin/staff
    """
    class Meta:
        model = FeeStructure
        fields = [
            'id',
            'class_fk',
            'term',
            'amount'
        ]


# ----------------------------
# STUDENT LEDGER SERIALIZERS
# ----------------------------

class StudentLedgerSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes student info
    """
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = StudentLedger
        fields = [
            'id',
            'student',
            'student_name',
            'transaction_type',
            'amount',
            'balance_after',
            'date',
            'reference'
        ]


class StudentLedgerCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For admin/staff
    """
    class Meta:
        model = StudentLedger
        fields = [
            'id',
            'student',
            'transaction_type',
            'amount',
            'balance_after',
            'date',
            'reference'
        ]


# ----------------------------
# PAYMENT SERIALIZERS
# ----------------------------

class PaymentSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes student info
    """
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'student',
            'student_name',
            'amount',
            'payment_method',
            'reference',
            'created_at'
        ]


class PaymentCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For processing payments
    """
    class Meta:
        model = Payment
        fields = [
            'id',
            'student',
            'amount',
            'payment_method',
            'reference'
        ]
