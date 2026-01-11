# import uuid
# from django.db import models
# from apps.students.models import Student
# from apps.staff.models import Staff

# # ----------------------------
# # Academic Level
# # ----------------------------
# class AcademicLevel(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=50)  # e.g., Primary, Secondary
#     order = models.IntegerField()  # e.g., 1=PP, 2=Grade 1

#     def __str__(self):
#         return self.name

# # ----------------------------
# # Class
# # ----------------------------
# class Class(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=50)
#     level = models.ForeignKey(AcademicLevel, on_delete=models.CASCADE)  # nested level
#     stream = models.CharField(max_length=10, blank=True, null=True)

#     def __str__(self):
#         return f"{self.name} ({self.level.name}{f' - {self.stream}' if self.stream else ''})"

# # ----------------------------
# # Subject
# # ----------------------------
# class Subject(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=100)
#     class_fk = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="subjects")
#     teacher = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True)

# # ----------------------------
# # Exam
# # ----------------------------
# class Exam(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=100)
#     term = models.CharField(max_length=50)
#     session = models.CharField(max_length=20)

# # ----------------------------
# # Result
# # ----------------------------
# class Result(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     student = models.ForeignKey(Student, on_delete=models.CASCADE)
#     subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
#     exam = models.ForeignKey(Exam, on_delete=models.CASCADE)
#     score = models.DecimalField(max_digits=5, decimal_places=2)
#     grade = models.CharField(max_length=5)

# academics/models.py
from django.db import models
from apps.school.models import School


class Curriculum(models.Model):
    """
    Different academic systems a school might run (can have multiple)
    Examples: CBC, 8-4-4, IGCSE, Cambridge, IB, etc.
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="curricula")
    name = models.CharField(max_length=120)  # "CBC", "8-4-4", "Cambridge IGCSE"
    short_code = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    # Optional overrides of school defaults
    term_system = models.CharField(max_length=20, blank=True, null=True)
    number_of_terms = models.PositiveIntegerField(null=True, blank=True)
    grading_system = models.CharField(max_length=20, blank=True, null=True)
    passing_mark = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        unique_together = ["school", "name"]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.school})"


class GradeLevel(models.Model):
    """
    Classes / Forms / Years / Grades
    Example: PP1, Grade 4, Form 2, Year 9
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="grade_levels")
    curriculum = models.ForeignKey(
        Curriculum, on_delete=models.CASCADE, related_name="grade_levels", null=True, blank=True
    )
    name = models.CharField(max_length=80)          # "Grade 4", "Form 2", "Year 9"
    short_name = models.CharField(max_length=30, blank=True)
    order = models.PositiveIntegerField(default=0)  # for sorting
    code = models.CharField(max_length=20, blank=True)  # optional internal code

    class Meta:
        ordering = ["order", "name"]
        unique_together = ["school", "name"]

    def __str__(self):
        return self.name


class Department(models.Model):
    """
    Streams / Departments / Faculties
    Example: Science, Humanities, Technical, Commercial
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="departments")
    curriculum = models.ForeignKey(
        Curriculum, on_delete=models.SET_NULL, null=True, blank=True, related_name="departments"
    )
    name = models.CharField(max_length=120)
    short_name = models.CharField(max_length=50, blank=True)
    code = models.CharField(max_length=20, blank=True)

    class Meta:
        unique_together = ["school", "name"]
        ordering = ["name"]

    def __str__(self):
        return self.name