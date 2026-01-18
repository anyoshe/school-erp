from django.db import models
from apps.school.models import School


class MedicalRecord(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='health_medical_records')
    student = models.OneToOneField('students.Student', on_delete=models.CASCADE, related_name='health_medical_record')
    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=150, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Medical Record - {self.student}"


class Vaccination(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='vaccinations')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='vaccinations')
    vaccine_name = models.CharField(max_length=100)
    date_administered = models.DateField()
    next_due = models.DateField(null=True, blank=True)
    administered_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.vaccine_name} - {self.student}"


class Allergy(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='allergies')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='allergies')
    allergen = models.CharField(max_length=150)
    severity = models.CharField(max_length=50, choices=[('mild', 'Mild'), ('moderate', 'Moderate'), ('severe', 'Severe')])
    reaction = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.allergen} ({self.student})"