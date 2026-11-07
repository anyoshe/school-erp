from rest_framework import serializers
from .models import Assessment, Mark


class AssessmentSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source="grade_level.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    term_name = serializers.CharField(source="term.name", read_only=True, default=None)
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True, default=None)
    marks_count = serializers.SerializerMethodField()
    entered_count = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            "id",
            "school",
            "name",
            "kind",
            "academic_year",
            "academic_year_name",
            "term",
            "term_name",
            "grade_level",
            "grade_name",
            "subject",
            "subject_name",
            "section",
            "section_name",
            "max_score",
            "weight",
            "assessment_date",
            "is_published",
            "notes",
            "marks_count",
            "entered_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["school"]

    def get_marks_count(self, obj):
        return getattr(obj, "_marks_count", obj.marks.count())

    def get_entered_count(self, obj):
        if hasattr(obj, "_entered_count"):
            return obj._entered_count
        return obj.marks.exclude(score__isnull=True).count()


class AssessmentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = [
            "id",
            "name",
            "kind",
            "academic_year",
            "term",
            "grade_level",
            "subject",
            "section",
            "max_score",
            "weight",
            "assessment_date",
            "is_published",
            "notes",
        ]


class MarkSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    admission_number = serializers.CharField(source="student.admission_number", read_only=True)
    percentage = serializers.SerializerMethodField()
    grade_letter = serializers.SerializerMethodField()

    class Meta:
        model = Mark
        fields = [
            "id",
            "assessment",
            "student",
            "student_name",
            "admission_number",
            "score",
            "is_absent",
            "remarks",
            "percentage",
            "grade_letter",
            "updated_at",
        ]
        read_only_fields = ["assessment"]

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.first_name or ''} {s.last_name or ''}".strip()

    def get_percentage(self, obj):
        p = obj.percentage
        return float(p) if p is not None else None

    def get_grade_letter(self, obj):
        return obj.grade_letter
