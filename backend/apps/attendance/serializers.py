from rest_framework import serializers
from .models import Attendance, StudentAttendance


class AttendanceSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    recorded_by_email = serializers.EmailField(source="recorded_by.email", read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id",
            "school",
            "user",
            "user_email",
            "date",
            "status",
            "recorded_by",
            "recorded_by_email",
        ]


class AttendanceCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ["id", "school", "user", "date", "status", "recorded_by"]
        read_only_fields = ["school", "recorded_by"]


class StudentAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    admission_number = serializers.CharField(source="student.admission_number", read_only=True)
    grade_name = serializers.CharField(source="grade_level.name", read_only=True, default=None)
    section_name = serializers.CharField(source="section.name", read_only=True, default=None)

    class Meta:
        model = StudentAttendance
        fields = [
            "id",
            "school",
            "student",
            "student_name",
            "admission_number",
            "date",
            "status",
            "notes",
            "grade_level",
            "grade_name",
            "section",
            "section_name",
            "recorded_by",
            "updated_at",
        ]
        read_only_fields = ["school", "recorded_by"]

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.first_name or ''} {s.last_name or ''}".strip()
