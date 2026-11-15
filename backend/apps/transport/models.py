from django.db import models
from apps.school.models import School


class Vehicle(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="vehicles")
    registration_number = models.CharField(max_length=50)
    make_model = models.CharField(max_length=100, blank=True)
    capacity = models.PositiveIntegerField(default=0)
    driver = models.ForeignKey(
        "Driver", on_delete=models.SET_NULL, null=True, blank=True, related_name="vehicles"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["school", "registration_number"],
                name="unique_vehicle_reg_per_school",
            )
        ]

    def __str__(self):
        return f"{self.registration_number} ({self.make_model})"


class Driver(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="drivers")
    name = models.CharField(max_length=150)
    license_number = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["school", "license_number"],
                name="unique_driver_license_per_school",
            )
        ]

    def __str__(self):
        return self.name


class Route(models.Model):
    """Transport route with term fee based on distance/zone."""
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="routes")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    term_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "name"],
                name="unique_route_name_per_school",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.term_amount})"


class StudentAssignment(models.Model):
    """Active transport subscription for a learner on a route."""
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name="student_assignments"
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="transport_assignments",
    )
    route = models.ForeignKey(
        Route, on_delete=models.SET_NULL, null=True, blank=True, related_name="assignments"
    )
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name="assignments"
    )
    pickup_point = models.CharField(max_length=255, blank=True)
    dropoff_point = models.CharField(max_length=255, blank=True)
    academic_year = models.CharField(max_length=20, blank=True)
    term = models.CharField(max_length=40, blank=True)
    amount_override = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-assigned_at"]

    def effective_amount(self):
        from decimal import Decimal
        if self.amount_override is not None:
            return Decimal(str(self.amount_override))
        if self.route_id and self.route:
            return Decimal(str(self.route.term_amount or 0))
        return Decimal("0")

    def __str__(self):
        return f"{self.student_id} → {self.route_id}"
