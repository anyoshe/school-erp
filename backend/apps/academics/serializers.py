# apps/academics/serializers.py
from rest_framework import serializers
from .models import Curriculum, GradeLevel, Department
from apps.school.models import School  # if needed for nested school display


class SchoolMiniSerializer(serializers.ModelSerializer):
    """Minimal school info for nested display"""
    class Meta:
        model = School
        fields = ['id', 'name', 'short_name']


class CurriculumSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)

    class Meta:
        model = Curriculum
        fields = [
            'id', 'school', 'name', 'short_code', 'description',
            'is_active', 'term_system', 'number_of_terms',
            'grading_system', 'passing_mark'
        ]
        read_only_fields = ['school']  # set via view/context


class CurriculumCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Curriculum
        fields = [
            'id', 'name', 'short_code', 'description',
            'is_active', 'term_system', 'number_of_terms',
            'grading_system', 'passing_mark', 'school'
        ]

def validate_school(self, value):
        request = self.context['request']
        user = request.user
        if not School.objects.filter(id=value, users=user).exists():
            raise serializers.ValidationError(
                "You do not have permission to create curriculum for this school."
            )
        return value

class GradeLevelSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)
    curriculum = CurriculumSerializer(read_only=True)

    class Meta:
        model = GradeLevel
        fields = [
            'id', 'school', 'curriculum', 'name', 'short_name',
            'order', 'code'
        ]
        read_only_fields = ['school']

class GradeLevelCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeLevel
        fields = [
            'id', 'curriculum', 'name', 'short_name',
            'order', 'code', 'school'
        ]

def validate_school(self, value):
        request = self.context['request']
        user = request.user
        if not School.objects.filter(id=value, users=user).exists():
            raise serializers.ValidationError(
                "You do not have permission to create grade level for this school."
            )
        return value
class DepartmentSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)
    curriculum = CurriculumSerializer(read_only=True)

    class Meta:
        model = Department
        fields = [
            'id', 'school', 'curriculum', 'name', 'short_name', 'code'
        ]
        read_only_fields = ['school']


class DepartmentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'curriculum', 'name', 'short_name', 'code', 'school'
        
        ]

def validate_school(self, value):
        request = self.context['request']
        user = request.user
        if not School.objects.filter(id=value, users=user).exists():
            raise serializers.ValidationError(
                "You do not have permission to create department for this school."
            )
        return value