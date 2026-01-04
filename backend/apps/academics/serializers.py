# from rest_framework import serializers
# from .models import Class, Subject, Exam, Result
# from apps.students.models import Student
# from apps.staff.models import Staff

# # ----------------------------
# # CLASS SERIALIZERS
# # ----------------------------

# class ClassSerializer(serializers.ModelSerializer):
#     """
#     READ-ONLY: Includes subjects list
#     """
#     subjects = serializers.StringRelatedField(many=True, read_only=True)

#     class Meta:
#         model = Class
#         fields = ['id', 'name', 'level', 'subjects']


# class ClassCreateUpdateSerializer(serializers.ModelSerializer):
#     """
#     CREATE / UPDATE: For admin or school staff
#     """
#     class Meta:
#         model = Class
#         fields = ['id', 'name', 'level']


# # ----------------------------
# # SUBJECT SERIALIZERS
# # ----------------------------

# class SubjectSerializer(serializers.ModelSerializer):
#     """
#     READ-ONLY: Includes teacher info
#     """
#     teacher_email = serializers.EmailField(source='teacher.user.email', read_only=True)

#     class Meta:
#         model = Subject
#         fields = ['id', 'name', 'class_fk', 'teacher', 'teacher_email']


# class SubjectCreateUpdateSerializer(serializers.ModelSerializer):
#     """
#     CREATE / UPDATE subject
#     """
#     class Meta:
#         model = Subject
#         fields = ['id', 'name', 'class_fk', 'teacher']


# # ----------------------------
# # EXAM SERIALIZERS
# # ----------------------------

# class ExamSerializer(serializers.ModelSerializer):
#     """
#     READ-ONLY: For listing exams
#     """
#     class Meta:
#         model = Exam
#         fields = ['id', 'name', 'term', 'session']


# class ExamCreateUpdateSerializer(serializers.ModelSerializer):
#     """
#     CREATE / UPDATE exam
#     """
#     class Meta:
#         model = Exam
#         fields = ['id', 'name', 'term', 'session']


# # ----------------------------
# # RESULT SERIALIZERS
# # ----------------------------

# class ResultSerializer(serializers.ModelSerializer):
#     """
#     READ-ONLY: Includes student, subject, exam names
#     """
#     student_name = serializers.CharField(source='student.__str__', read_only=True)
#     subject_name = serializers.CharField(source='subject.name', read_only=True)
#     exam_name = serializers.CharField(source='exam.name', read_only=True)

#     class Meta:
#         model = Result
#         fields = [
#             'id',
#             'student',
#             'student_name',
#             'subject',
#             'subject_name',
#             'exam',
#             'exam_name',
#             'score',
#             'grade'
#         ]


# class ResultCreateUpdateSerializer(serializers.ModelSerializer):
#     """
#     CREATE / UPDATE results
#     """
#     class Meta:
#         model = Result
#         fields = ['id', 'student', 'subject', 'exam', 'score', 'grade']


from rest_framework import serializers
from .models import AcademicLevel, Class, Subject, Exam, Result
from apps.students.models import Student
from apps.staff.models import Staff

# ----------------------------
# Academic Level
# ----------------------------
class AcademicLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicLevel
        fields = ['id', 'name', 'order']

# ----------------------------
# Class Serializers
# ----------------------------
class ClassSerializer(serializers.ModelSerializer):
    level = AcademicLevelSerializer()  # nested
    subjects = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Class
        fields = ['id', 'name', 'level', 'subjects', 'stream']

class ClassCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'name', 'level', 'stream']

# ----------------------------
# Subject Serializers
# ----------------------------
class SubjectSerializer(serializers.ModelSerializer):
    teacher_email = serializers.EmailField(source='teacher.user.email', read_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'class_fk', 'teacher', 'teacher_email']

class SubjectCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'class_fk', 'teacher']

# ----------------------------
# Exam Serializers
# ----------------------------
class ExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = ['id', 'name', 'term', 'session']

class ExamCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = ['id', 'name', 'term', 'session']

# ----------------------------
# Result Serializers
# ----------------------------
class ResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.__str__', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)

    class Meta:
        model = Result
        fields = [
            'id',
            'student',
            'student_name',
            'subject',
            'subject_name',
            'exam',
            'exam_name',
            'score',
            'grade'
        ]

class ResultCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = ['id', 'student', 'subject', 'exam', 'score', 'grade']
