# # academics/models.py
# import uuid
# from django.db import models
# from apps.students.models import Student
# from apps.staff.models import Staff

# # academics/models.py

# # 1. Add AcademicLevel
# class AcademicLevel(models.Model):
#     name = models.CharField(max_length=50)  # e.g., Primary, Secondary
#     order = models.IntegerField()

#     def __str__(self):
#         return self.name

# # 2. Update Class model
# class Class(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=50)
#     level = models.ForeignKey(AcademicLevel, on_delete=models.CASCADE)  # updated
#     stream = models.CharField(max_length=10, blank=True, null=True)
#     # Phase-4-ready school FK
#     # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)


# # class Class(models.Model):
# #     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
# #     name = models.CharField(max_length=50)
# #     level = models.IntegerField()
    
# class Subject(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=100)
#     class_fk = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="subjects")
#     teacher = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True)

# class Exam(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=100)
#     term = models.CharField(max_length=50)
#     session = models.CharField(max_length=20)
#      # Optional school FK if exams are school-specific
#     # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)

# class Result(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     student = models.ForeignKey(Student, on_delete=models.CASCADE)
#     subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
#     exam = models.ForeignKey(Exam, on_delete=models.CASCADE)
#     score = models.DecimalField(max_digits=5, decimal_places=2)
#     grade = models.CharField(max_length=5)
#       # Phase-4-ready school FK
#     # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)


import uuid
from django.db import models
from apps.students.models import Student
from apps.staff.models import Staff

# ----------------------------
# Academic Level
# ----------------------------
class AcademicLevel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)  # e.g., Primary, Secondary
    order = models.IntegerField()  # e.g., 1=PP, 2=Grade 1

    def __str__(self):
        return self.name

# ----------------------------
# Class
# ----------------------------
class Class(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    level = models.ForeignKey(AcademicLevel, on_delete=models.CASCADE)  # nested level
    stream = models.CharField(max_length=10, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.level.name}{f' - {self.stream}' if self.stream else ''})"

# ----------------------------
# Subject
# ----------------------------
class Subject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    class_fk = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="subjects")
    teacher = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True)

# ----------------------------
# Exam
# ----------------------------
class Exam(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    term = models.CharField(max_length=50)
    session = models.CharField(max_length=20)

# ----------------------------
# Result
# ----------------------------
class Result(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE)
    score = models.DecimalField(max_digits=5, decimal_places=2)
    grade = models.CharField(max_length=5)
