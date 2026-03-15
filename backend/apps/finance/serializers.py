import uuid
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
        request = self.context['request']
        user = request.user
        if value not in School.objects.filter(users=user):
            raise serializers.ValidationError("You do not have permission for this school.")
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
        request = self.context['request']
        school_id = request.headers.get('X-School-ID')
        print(f"[DEBUG] PATCH validate_category: item={self.instance.id if self.instance else 'new'}, "
            f"header_school={school_id}, category_school={value.school_id}")
        
        if school_id and str(value.school_id) != school_id:
            print(f"[DEBUG] MISMATCH → raising ValidationError")
            raise serializers.ValidationError("Category does not belong to the selected school.")
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

class FeeStructureItemSerializer(serializers.ModelSerializer):
    item = serializers.PrimaryKeyRelatedField(queryset=FeeItem.objects.all())
    item_details = FeeItemSerializer(source='item', read_only=True)

    class Meta:
        model = FeeStructureItem
        fields = ['id', 'item', 'item_details', 'amount']

    def validate_item(self, value):
        # Ensure item belongs to the same school as the parent structure
        structure = self.context.get("structure")
        if structure and value.category.school != structure.school:
            raise serializers.ValidationError(
                "Fee item does not belong to the same school as this fee structure."
            )
        return value

class FeeStructureSerializer(serializers.ModelSerializer):

    school = SchoolSerializer(read_only=True)
    grade_level = GradeLevelSerializer(read_only=True)

    structure_items = FeeStructureItemSerializer(many=True, read_only=True)
    available_optional_items_details = FeeItemSerializer(
        source='available_optional_items', 
        many=True, 
        read_only=True
    )

    total_amount = serializers.ReadOnlyField()

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
            "available_optional_items_details",  
            "created_at",
            "updated_at"
        ]

class FeeStructureCreateUpdateSerializer(serializers.ModelSerializer):
    structure_items = FeeStructureItemSerializer(many=True)
    available_optional_items = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=FeeItem.objects.all(), # Remove the .filter(is_optional=True)
        required=False
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
        request = self.context['request']
        user_schools = School.objects.filter(users=request.user)
        if value not in user_schools:
            raise serializers.ValidationError("You do not have permission for this school.")
        return value

    def validate_grade_level(self, value):
        # Ensure grade level belongs to the selected school
        school_id_input = self.initial_data.get('school')
        if school_id_input:
            try:
                import uuid
                school_uuid = uuid.UUID(str(school_id_input))
                if value.school_id != school_uuid:
                    raise serializers.ValidationError(
                        "Selected grade level does not belong to the chosen school."
                    )
            except ValueError:
                raise serializers.ValidationError("Invalid school ID format.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("structure_items", [])
        # Extract optional items IDs
        optional_items = validated_data.pop("available_optional_items", [])
        
        structure = FeeStructure.objects.create(**validated_data)
        
        # 1. Save the Mandatory/Fixed Items
        self._save_items(structure, items_data)
        
        # 2. Save the Optional Items Relationship
        if optional_items:
            structure.available_optional_items.set(optional_items)
            
        return structure

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("structure_items", None)
        # Extract optional items IDs
        optional_items = validated_data.pop("available_optional_items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update Structure Items (Delete and Re-create pattern you're using)
        if items_data is not None:
            instance.structure_items.all().delete()
            self._save_items(instance, items_data)
            
        # Update Optional Items Relationship
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
            'days_interval', 'is_active'
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

    class Meta:
        model = StudentFeeAssignment
        fields = [
            'id', 'student', 'fee_structure', 'fee_structure_details', 'optional_items_details', 'payment_plan', 'waiver_amount', 'waiver_reason',
            'is_waived', 'assigned_at', 'assigned_by', 'effective_total'
        ]


class StudentFeeAssignmentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentFeeAssignment
        fields = [
            'id', 'student', 'fee_structure', 'waiver_amount', 'waiver_reason', 'is_waived', 'payment_plan', 'selected_optional_items'
        ]

    def create(self, validated_data):
        validated_data['assigned_by'] = self.context['request'].user
        validated_data['assigned_at'] = timezone.now().date()
        return super().create(validated_data)

class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = ['id', 'item', 'description', 'amount']

class InvoiceSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    fee_assignment = StudentFeeAssignmentSerializer(read_only=True)
    payments = serializers.SerializerMethodField()
    lines = InvoiceLineSerializer(many=True, read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    current_total_due = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'student', 'fee_assignment', 'term', 'academic_year',
            'invoice_number', 'amount_due', 'amount_paid', 'balance',
            'due_date', 'generated_at', 'generated_by', 'is_paid', 'paid_at', 'payments', 'lines', 'current_total_due', 'late_fee_applied'
        ]

    def get_payments(self, obj):
        return PaymentSerializer(obj.payments.all(), many=True).data


class InvoiceCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = [
            'id', 'student', 'fee_assignment', 'term', 'academic_year',
            'amount_due', 'due_date', 'generated_by'
        ]


    def create(self, validated_data):
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
        if data['amount'] <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return data
    
    def create(self, validated_data):
        return Payment.objects.create(**validated_data)
    