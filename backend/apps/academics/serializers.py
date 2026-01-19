# apps/academics/serializers.py
from rest_framework import serializers
from .models import Curriculum, GradeLevel, Department
from apps.school.models import School


class SchoolMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'short_name']


class CurriculumTemplateSerializer(serializers.ModelSerializer):
    """Used only for listing templates in setup wizard"""
    class Meta:
        model = Curriculum
        fields = ['id', 'name', 'short_code', 'description', 'is_active']
        read_only_fields = fields


class CurriculumSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)

    class Meta:
        model = Curriculum
        fields = [
            'id', 'school', 'name', 'short_code', 'description',
            'is_active', 'is_template',
            'term_system', 'number_of_terms',
            'grading_system', 'passing_mark'
        ]
        read_only_fields = ['school', 'is_template']


class CurriculumCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Curriculum
        fields = [
            'id', 'name', 'short_code', 'description',
            'is_active', 'term_system', 'number_of_terms',
            'grading_system', 'passing_mark'
        ]

    def validate(self, data):
        # During creation in wizard: allow no school (will be set in view)
        if self.context.get('is_wizard'):
            return data
        # Normal creation → require school
        if 'school' not in data and not self.instance:
            raise serializers.ValidationError({"school": "This field is required."})
        return data


class GradeLevelSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)
    curriculum = CurriculumSerializer(read_only=True)

    class Meta:
        model = GradeLevel
        fields = '__all__'
        read_only_fields = ['school']


class GradeLevelCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeLevel
        fields = ['id', 'curriculum', 'name', 'short_name', 'order', 'code']


class DepartmentSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)
    curriculum = CurriculumSerializer(read_only=True)

    class Meta:
        model = Department
        fields = '__all__'
        read_only_fields = ['school']


class DepartmentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'curriculum', 'name', 'short_name', 'code']