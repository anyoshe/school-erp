# apps/finance/serializers.py
from rest_framework import serializers
from .models import FeeCategory, FeeItem
from apps.school.serializers import SchoolMiniSerializer  # if you have one, or create it
from apps.academics.serializers import GradeLevelSerializer, DepartmentSerializer
from apps.school.models import School   # ← add this line!
from apps.academics.models import GradeLevel, Department  # ← add this line
from rest_framework.fields import UUIDField
from uuid import UUID

class SchoolMiniSerializer(serializers.ModelSerializer):
    """Minimal school info for nested display (if not already defined elsewhere)"""
    class Meta:
        model = School
        fields = ['id', 'name', 'short_name']


class FeeCategorySerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)

    class Meta:
        model = FeeCategory
        fields = [
            'id', 'school', 'name', 'description',
            'is_mandatory', 'display_order'
        ]
        read_only_fields = ['school']

class FeeCategoryCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = [
            'id', 'name', 'description', 'is_mandatory', 'display_order', 'school'
        ]

    def validate_school(self, value):
        # value is now a School INSTANCE (DRF resolved the UUID automatically)
        print("DEBUG: validate_school received:", value, type(value))

        request = self.context['request']
        user = request.user

        # Check if this school belongs to the current user
        if value not in School.objects.filter(users=user):
            raise serializers.ValidationError(
                "You do not have permission to create fee category for this school."
            )

        return value
    
class FeeItemSerializer(serializers.ModelSerializer):
    category = FeeCategorySerializer(read_only=True)
    grade_levels = GradeLevelSerializer(many=True, read_only=True)
    departments = DepartmentSerializer(many=True, read_only=True)

    class Meta:
        model = FeeItem
        fields = [
            'id', 'category', 'name', 'amount', 'currency',
            'frequency', 'is_active',
            'grade_levels', 'departments'
        ]


class FeeItemCreateUpdateSerializer(serializers.ModelSerializer):
    grade_level_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=GradeLevel.objects.all(), required=False, write_only=True
    )
    department_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Department.objects.all(), required=False, write_only=True
    )

    class Meta:
        model = FeeItem
        fields = [
            'id', 'category', 'name', 'amount', 'currency',
            'frequency', 'is_active',
            'grade_level_ids', 'department_ids',
        ]

    def create(self, validated_data):
        grade_level_ids = validated_data.pop('grade_level_ids', [])
        department_ids = validated_data.pop('department_ids', [])
        fee_item = FeeItem.objects.create(**validated_data)
        if grade_level_ids:
            fee_item.grade_levels.set(grade_level_ids)
        if department_ids:
            fee_item.departments.set(department_ids)
        return fee_item

    def update(self, instance, validated_data):
        grade_level_ids = validated_data.pop('grade_level_ids', None)
        department_ids = validated_data.pop('department_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if grade_level_ids is not None:
            instance.grade_levels.set(grade_level_ids)
        if department_ids is not None:
            instance.departments.set(department_ids)
        return instance