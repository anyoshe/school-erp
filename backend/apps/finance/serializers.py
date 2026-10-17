import uuid
from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import (
    FeeCategory, FeeItem, FeeStructure, FeeStructureItem, PaymentPlan, PaymentPlanInstallment, StudentFeeAssignment,
    Invoice,InvoiceLine, Payment
)
from apps.school.models import School
from apps.school.serializers import SchoolSerializer
from apps.academics.models import GradeLevel
from apps.academics.serializers import GradeLevelSerializer
from apps.students.models import Student, StudentGuardian
from apps.students.serializers import StudentSerializer, StudentGuardianSerializer
from apps.school.support import selected_school


def _selected_school_for_serializer(serializer):
    return selected_school(serializer.context["request"])

class FeeCategoryLiteSerializer(serializers.ModelSerializer):
    """id/name only — for fee structure form dropdowns."""
    class Meta:
        model = FeeCategory
        fields = ["id", "name", "is_mandatory", "display_order"]


class FeeCategorySerializer(serializers.ModelSerializer):

    school = SchoolSerializer(read_only=True)

    class Meta:
        model = FeeCategory
        fields = ['id', 'school', 'name', 'description', 'is_mandatory', 'display_order']
        read_only_fields = ['school']


class FeeCategoryCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = ['id', 'name', 'description', 'is_mandatory', 'display_order', 'school']

    def validate_school(self, value):
        if value != _selected_school_for_serializer(self):
            raise serializers.ValidationError("School must match the selected school.")
        return value

# --- Fee Item & Structure Serializers ---

class FeeItemSerializer(serializers.ModelSerializer):
    category = FeeCategorySerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    grade_levels = GradeLevelSerializer(many=True, read_only=True)

    class Meta:
        model = FeeItem
        fields = [
            'id', 'category', 'name','category_name', 'description',
            'frequency', 'is_active', 'is_statutory', 'is_optional', 'grade_levels'
        ]

class FeeItemCreateUpdateSerializer(serializers.ModelSerializer):
    grade_level_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=GradeLevel.objects.all(), required=False, write_only=True
    )

    class Meta:
        model = FeeItem
        fields = [
            'id', 'category', 'name', 'description',
            'frequency', 'is_active', 'is_statutory', 'grade_level_ids'
        ]

    def validate_category(self, value):
        school = _selected_school_for_serializer(self)
        if value.school_id != school.id:
            raise serializers.ValidationError("Category does not belong to the selected school.")
        return value

    def validate_grade_level_ids(self, value):
        school = _selected_school_for_serializer(self)
        if any(grade_level.school_id != school.id for grade_level in value):
            raise serializers.ValidationError(
                "Grade levels must belong to the selected school."
            )
        return value

    def create(self, validated_data):
        grade_level_ids = validated_data.pop('grade_level_ids', [])
        fee_item = FeeItem.objects.create(**validated_data)
        if grade_level_ids:
            fee_item.grade_levels.set(grade_level_ids)
        return fee_item

    def update(self, instance, validated_data):
        grade_level_ids = validated_data.pop('grade_level_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if grade_level_ids is not None:
            instance.grade_levels.set(grade_level_ids)
        return instance

class FeeStructureItemLiteSerializer(serializers.ModelSerializer):
    """Enough for edit form — no nested grade_levels trees."""
    item_name = serializers.CharField(source="item.name", read_only=True)
    category_id = serializers.UUIDField(source="item.category_id", read_only=True)
    category_name = serializers.CharField(source="item.category.name", read_only=True)
    is_optional = serializers.BooleanField(source="item.is_optional", read_only=True)

    class Meta:
        model = FeeStructureItem
        fields = ["id", "item", "item_name", "category_id", "category_name", "amount", "is_optional"]


class FeeStructureItemSerializer(serializers.ModelSerializer):

    item = serializers.PrimaryKeyRelatedField(queryset=FeeItem.objects.all())
    item_details = FeeItemSerializer(source='item', read_only=True)
    category_name = serializers.CharField(source='item.category.name', read_only=True)

    class Meta:
        model = FeeStructureItem
        fields = ['id', 'item', 'item_details', 'category_name', 'amount']

    def validate_item(self, value):
        # Ensure item belongs to the same school as the parent structure
        structure = self.context.get("structure")
        if structure and value.category.school != structure.school:
            raise serializers.ValidationError(
                "Fee item does not belong to the same school as this fee structure."
            )
        return value

class FeeStructureListSerializer(serializers.ModelSerializer):
    """
    Fast list payload for Fee structures page.
    No nested FeeItem trees; total from annotation when present.
    """
    grade_level = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "name",
            "grade_level",
            "academic_year",
            "billing_period_type",
            "period_name",
            "is_active",
            "total_amount",
            "updated_at",
        ]

    def get_grade_level(self, obj):
        g = getattr(obj, "grade_level", None)
        if not g:
            return None
        return {"id": str(g.id), "name": g.name, "short_name": getattr(g, "short_name", "") or ""}

    def get_total_amount(self, obj):
        # Prefer annotated value from queryset (one SQL GROUP BY)
        annotated = getattr(obj, "items_total", None)
        if annotated is not None:
            return annotated
        return obj.total_amount


class FeeStructureSerializer(serializers.ModelSerializer):


    school = serializers.UUIDField(source="school_id", read_only=True)
    grade_level = serializers.SerializerMethodField()

    structure_items = FeeStructureItemLiteSerializer(many=True, read_only=True)
    available_optional_items = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    total_amount = serializers.ReadOnlyField()

    def get_grade_level(self, obj):
        g = obj.grade_level
        if not g:
            return None
        return {"id": str(g.id), "name": g.name, "short_name": getattr(g, "short_name", "") or ""}

    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "school",
            "name",
            "description",
            "grade_level",
            "academic_year",
            "billing_period_type",
            "period_name",
            "is_active",
            "total_amount",
            "structure_items",
            "available_optional_items",
            "created_at",
            "updated_at",
        ]

class FeeStructureItemWriteSerializer(serializers.Serializer):
    """Minimal write shape for structure lines — avoids nested read-only fields."""
    item = serializers.PrimaryKeyRelatedField(queryset=FeeItem.objects.all())
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class FeeStructureCreateUpdateSerializer(serializers.ModelSerializer):
    structure_items = FeeStructureItemWriteSerializer(many=True, required=False)
    available_optional_items = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=FeeItem.objects.all(),
        required=False,
    )
    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "name",
            "description",
            "grade_level",
            "academic_year",
            "billing_period_type",
            "period_name",
            "is_active",
            "school",
            "structure_items",
            "available_optional_items",
        ]

    def validate_school(self, value):
        if value != _selected_school_for_serializer(self):
            raise serializers.ValidationError("School must match the selected school.")
        return value

    def validate_grade_level(self, value):
        school = _selected_school_for_serializer(self)
        if value.school_id != school.id:
            raise serializers.ValidationError(
                "Selected grade level does not belong to the selected school."
            )
        return value

    def validate_available_optional_items(self, value):
        school = _selected_school_for_serializer(self)
        if any(item.category.school_id != school.id for item in value):
            raise serializers.ValidationError(
                "Optional fee items must belong to the selected school."
            )
        return value

    def validate(self, attrs):
        school = _selected_school_for_serializer(self)
        structure_school = attrs.get("school", getattr(self.instance, "school", school))
        if structure_school != school:
            raise serializers.ValidationError(
                {"school": "School must match the selected school."}
            )
        for item_data in attrs.get("structure_items", []):
            if item_data["item"].category.school_id != school.id:
                raise serializers.ValidationError(
                    {"structure_items": "Fee items must belong to the selected school."}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from django.db import IntegrityError

        items_data = validated_data.pop("structure_items", [])
        optional_items = validated_data.pop("available_optional_items", [])

        if not items_data:
            raise serializers.ValidationError(
                {"structure_items": "Add at least one fee line with an amount."}
            )

        try:
            structure = FeeStructure.objects.create(**validated_data)
        except IntegrityError:
            raise serializers.ValidationError(
                {
                    "detail": (
                        "A fee structure already exists for this grade, period, and academic year. "
                        "Change the period name (e.g. Term 2) or edit the existing structure."
                    )
                }
            )

        self._save_items(structure, items_data)
        if optional_items:
            structure.available_optional_items.set(optional_items)
        return structure

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        Partial-friendly update:
        - Only fields present in validated_data are written.
        - structure_items: if provided (including []), replace lines; if omitted, keep existing.
        - available_optional_items: same rule.
        """
        items_data = validated_data.pop("structure_items", None)
        optional_items = validated_data.pop("available_optional_items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.structure_items.all().delete()
            if items_data:
                self._save_items(instance, items_data)

        if optional_items is not None:
            instance.available_optional_items.set(optional_items)

        return instance

    def _save_items(self, structure, items_data):
        """Helper to create FeeStructureItems"""
        for item_datum in items_data:
            FeeStructureItem.objects.create(
                structure=structure,
                item=item_datum['item'],
                amount=item_datum['amount']
            )

# --- Payment Plan Serializers ---
class PaymentPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentPlan
        fields = [
            'id', 'name', 'plan_type', 'number_of_installments', 
            'days_interval', 'is_active', 'is_recommended',
            'first_installment_percentage', "description"
        ]

    def validate(self, data):
        if data['number_of_installments'] < 1:
            raise serializers.ValidationError("Must have at least 1 installment.")
        return data
class PaymentPlanInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentPlanInstallment
        fields = ['id', 'name', 'percentage', 'order', 'days_after_start']


class StudentFeeAssignmentSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    fee_structure = FeeStructureSerializer(read_only=True)
    fee_structure_details = FeeStructureSerializer(source='fee_structure', read_only=True)
    optional_items_details = FeeItemSerializer(source='selected_optional_items', many=True, read_only=True)
    effective_total = serializers.ReadOnlyField()
    remaining_total = serializers.ReadOnlyField()
    item_amounts = serializers.JSONField(read_only=True)
    assignment_items = serializers.SerializerMethodField()

    class Meta:
        model = StudentFeeAssignment
        fields = [
            'id', 'student', 'fee_structure', 'fee_structure_details', 'optional_items_details', 'assignment_items',
            'item_amounts', 'payment_plan', 'waiver_amount', 'waiver_reason',
            'is_waived', 'assigned_at', 'assigned_by', 'custom_due_date', 'effective_total', 'remaining_total'
        ]

    def get_assignment_items(self, obj):
        return [
            {
                'item_id': entry['item_id'],
                'name': entry['description'],
                'category': entry['category'],
                'cost': float(entry['cost']),
                'deposit_allocated': float(entry['deposit_allocated']),
                'remaining_amount': float(entry['remaining_amount']),
                'is_optional': entry['is_optional'],
                'is_admission': entry['is_admission'],
            }
            for entry in obj.get_assignment_items()
        ]


class StudentFeeAssignmentCreateUpdateSerializer(serializers.ModelSerializer):
    item_amounts = serializers.JSONField(required=False)

    class Meta:
        model = StudentFeeAssignment
        fields = [
            'id', 'student', 'fee_structure', 'waiver_amount', 'waiver_reason', 'is_waived', 'payment_plan', 'custom_due_date', 'selected_optional_items', 'item_amounts'
        ]

    def validate_student(self, value):
        school = _selected_school_for_serializer(self)
        if value.school_id != school.id:
            raise serializers.ValidationError(
                "Student must belong to the selected school."
            )
        return value

    def validate_fee_structure(self, value):
        school = _selected_school_for_serializer(self)
        if value and value.school_id != school.id:
            raise serializers.ValidationError(
                "Fee structure must belong to the selected school."
            )
        return value

    def validate_payment_plan(self, value):
        school = _selected_school_for_serializer(self)
        if value and value.school_id != school.id:
            raise serializers.ValidationError(
                "Payment plan must belong to the selected school."
            )
        return value

    def validate_selected_optional_items(self, value):
        school = _selected_school_for_serializer(self)
        if any(item.category.school_id != school.id for item in value):
            raise serializers.ValidationError(
                "Optional fee items must belong to the selected school."
            )
        return value

    def create(self, validated_data):
        validated_data['assigned_by'] = self.context['request'].user
        validated_data['assigned_at'] = timezone.now().date()
        return super().create(validated_data)

class InvoiceLineSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='item.category.name', read_only=True)

    class Meta:
        model = InvoiceLine
        fields = ['id', 'item', 'description', 'amount', 'category_name']

class InvoicePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'amount', 'payment_method', 'reference_number',
            'paid_at', 'paid_by', 'notes'
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    fee_assignment = StudentFeeAssignmentSerializer(read_only=True)
    payments = serializers.SerializerMethodField()
    lines = InvoiceLineSerializer(many=True, read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    current_total_due = serializers.ReadOnlyField()
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'student', 'student_name', 'fee_assignment', 'term', 'academic_year',
            'invoice_number', 'amount_due', 'amount_paid', 'balance',
            'due_date', 'generated_at', 'generated_by', 'is_paid', 'paid_at', 'payments', 'lines', 'current_total_due', 'late_fee_applied'
        ]

    def get_balance(self, obj):
        balance = obj.current_total_due - obj.amount_paid
        return float(max(Decimal('0'), balance))

    def get_payments(self, obj):
        return InvoicePaymentSerializer(obj.payments.all(), many=True).data


class InvoiceCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = [
            'id', 'student', 'fee_assignment', 'term', 'academic_year',
            'amount_due', 'due_date', 'generated_by'
        ]

    def validate_student(self, value):
        school = _selected_school_for_serializer(self)
        if value.school_id != school.id:
            raise serializers.ValidationError(
                "Student must belong to the selected school."
            )
        return value

    def validate_fee_assignment(self, value):
        school = _selected_school_for_serializer(self)
        if value.student.school_id != school.id:
            raise serializers.ValidationError(
                "Fee assignment must belong to the selected school."
            )
        student_id = self.initial_data.get(
            "student",
            str(self.instance.student_id) if self.instance else None,
        )
        if student_id and str(value.student_id) != str(student_id):
            raise serializers.ValidationError(
                "Fee assignment must belong to the selected student."
            )
        return value

    def validate(self, attrs):
        school = _selected_school_for_serializer(self)
        student = attrs.get("student", getattr(self.instance, "student", None))
        fee_assignment = attrs.get(
            "fee_assignment", getattr(self.instance, "fee_assignment", None)
        )
        if student and student.school_id != school.id:
            raise serializers.ValidationError(
                {"student": "Student must belong to the selected school."}
            )
        if fee_assignment:
            if fee_assignment.student.school_id != school.id:
                raise serializers.ValidationError(
                    {"fee_assignment": "Fee assignment must belong to the selected school."}
                )
            if student and fee_assignment.student_id != student.id:
                raise serializers.ValidationError(
                    {"fee_assignment": "Fee assignment must belong to the selected student."}
                )
            if (
                fee_assignment.fee_structure
                and fee_assignment.fee_structure.school_id != school.id
            ):
                raise serializers.ValidationError(
                    {"fee_assignment": "Fee structure must belong to the selected school."}
                )
            if (
                fee_assignment.payment_plan
                and fee_assignment.payment_plan.school_id != school.id
            ):
                raise serializers.ValidationError(
                    {"fee_assignment": "Payment plan must belong to the selected school."}
                )
        return attrs


    def create(self, validated_data):
        validated_data["school"] = _selected_school_for_serializer(self)
        validated_data['generated_by'] = self.context['request'].user
        return super().create(validated_data)


class PaymentSerializer(serializers.ModelSerializer):
    invoice = InvoiceSerializer(read_only=True)
    paid_by = StudentGuardianSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'amount', 'payment_method', 'reference_number',
            'paid_at', 'paid_by', 'notes'
        ]
    
class PaymentCreateUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = Payment
        fields = [
            'id', 'school', 'invoice', 'amount', 'payment_method', 'reference_number',
            'paid_by', 'notes'
        ]
    def validate(self, data):
        school = _selected_school_for_serializer(self)
        amount = data.get("amount", self.instance.amount if self.instance else None)
        if amount is None or amount <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")

        invoice = data.get(
            "invoice", self.instance.invoice if self.instance else None
        )
        paid_by = data.get(
            "paid_by", self.instance.paid_by if self.instance else None
        )
        if invoice and (
            invoice.school_id != school.id
            or invoice.student.school_id != school.id
        ):
            raise serializers.ValidationError(
                {"invoice": "Invoice must belong to the selected school."}
            )
        if paid_by and paid_by.student.school_id != school.id:
            raise serializers.ValidationError(
                {"paid_by": "Payer must belong to the selected school."}
            )
        if invoice and paid_by and paid_by.student_id != invoice.student_id:
            raise serializers.ValidationError(
                {"paid_by": "Payer must be linked to the invoice's student."}
            )
        data["school"] = school
        if invoice:
            outstanding = invoice.current_total_due - invoice.amount_paid
            if amount > outstanding:
                raise serializers.ValidationError(
                    "Payment amount cannot exceed the invoice outstanding balance."
                )

        return data
    
    def create(self, validated_data):
        return Payment.objects.create(**validated_data)
