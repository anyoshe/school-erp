# apps/academics/serializers.py
from rest_framework import serializers
from .models import (
    Curriculum, GradeLevel, Department, AcademicYear, Term,
    Section, Stream, Subject, SubjectGroup,
)
from apps.school.models import School


class SchoolMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'short_name']


class CurriculumTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Curriculum
        fields = ['id', 'name', 'short_code',  'is_active']
        read_only_fields = fields


class CurriculumSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)

    class Meta:
        model = Curriculum
        fields = [
            'id', 'school', 'name', 'short_code', 
            'is_active', 'is_template',
            'term_system', 'number_of_terms',
            'grading_system', 'passing_mark'
        ]
        read_only_fields = ['school', 'is_template']


class CurriculumCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Curriculum
        fields = [
            'id', 'name', 'short_code', 
            'is_active', 'term_system', 'number_of_terms',
            'grading_system', 'passing_mark'
        ]


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ['id', 'grade_level', 'name',  'capacity', 'is_active']


class StreamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stream
        fields = ['id', 'grade_level', 'name',  'capacity', 'is_active']


class GradeLevelLiteSerializer(serializers.ModelSerializer):
    """Minimal grade payload for selects/forms (no N+1 counts or nested trees)."""
    class Meta:
        model = GradeLevel
        fields = ["id", "name", "short_name", "order", "code", "curriculum"]


class GradeLevelSerializer(serializers.ModelSerializer):

    school = SchoolMiniSerializer(read_only=True)
    curriculum_name = serializers.CharField(source='curriculum.name', read_only=True)
    sections = SectionSerializer(many=True, read_only=True)
    streams = StreamSerializer(many=True, read_only=True)
    section_count = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = GradeLevel
        fields = [
            'id', 'school', 'curriculum', 'curriculum_name', 'name', 'short_name',
            'order', 'code', 'education_level', 'sections', 'streams',
            'section_count', 'student_count',
        ]
        read_only_fields = ['school']

    def get_section_count(self, obj):
        return obj.sections.filter(is_active=True).count()

    def get_student_count(self, obj):
        try:
            return obj.students.filter(status='ACTIVE').count()
        except Exception:
            return 0


class GradeLevelCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeLevel
        fields = [
            'id', 'curriculum', 'name', 'short_name', 'order',
            'code', 'education_level',
        ]


class DepartmentSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)

    class Meta:
        model = Department
        fields = '__all__'
        read_only_fields = ['school']


class DepartmentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'curriculum', 'name', 'code',  'is_active']


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ['id', 'academic_year', 'name', 'start_date', 'end_date', 'order']


class AcademicYearSerializer(serializers.ModelSerializer):
    terms = TermSerializer(many=True, read_only=True)
    term_count = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = AcademicYear
        fields = [
            'id', 'school', 'name', 'start_date', 'end_date',
            'is_active', 'terms', 'term_count', 'is_current',
        ]
        read_only_fields = ['school']

    def get_term_count(self, obj):
        return obj.terms.count()

    def get_is_current(self, obj):
        from django.utils import timezone
        today = timezone.now().date()
        return obj.is_active and obj.start_date <= today <= obj.end_date


class AcademicYearCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'start_date', 'end_date', 'is_active']


class TermCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ['id', 'academic_year', 'name', 'start_date', 'end_date', 'order']


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = [
            'id', 'school', 'name', 'code', 'department',
            'is_compulsory', 'is_active', 
        ]
        read_only_fields = ['school']


class SubjectCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'code', 'department',
            'is_compulsory', 'is_active', 
        ]
