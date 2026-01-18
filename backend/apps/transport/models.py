from django.db import models
from apps.school.models import School  # Adjust path if needed


class Vehicle(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='vehicles')
    registration_number = models.CharField(max_length=50, unique=True)
    make_model = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField()
    driver = models.ForeignKey('Driver', on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.registration_number} ({self.make_model})"


class Driver(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='drivers')
    name = models.CharField(max_length=150)
    license_number = models.CharField(max_length=50, unique=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Route(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='routes')
    name = models.CharField(max_length=150)  # e.g. "Route A - Eastlands"
    description = models.TextField(blank=True)
    distance_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class StudentAssignment(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='student_assignments')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='transport_assignments')  # Link to students app
    route = models.ForeignKey(Route, on_delete=models.SET_NULL, null=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True)
    pickup_point = models.CharField(max_length=255, blank=True)
    dropoff_point = models.CharField(max_length=255, blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} → {self.route}"