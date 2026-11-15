from rest_framework import serializers
from .models import Route, Vehicle, Driver, StudentAssignment


class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = [
            "id",
            "name",
            "description",
            "distance_km",
            "term_amount",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            "id",
            "registration_number",
            "make_model",
            "capacity",
            "driver",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = [
            "id",
            "name",
            "license_number",
            "phone",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StudentAssignmentSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source="route.name", read_only=True)
    student_name = serializers.SerializerMethodField()
    admission_number = serializers.CharField(source="student.admission_number", read_only=True)
    effective_amount = serializers.SerializerMethodField()

    class Meta:
        model = StudentAssignment
        fields = [
            "id",
            "student",
            "student_name",
            "admission_number",
            "route",
            "route_name",
            "vehicle",
            "pickup_point",
            "dropoff_point",
            "academic_year",
            "term",
            "amount_override",
            "effective_amount",
            "is_active",
            "assigned_at",
            "updated_at",
            "notes",
        ]
        read_only_fields = ["id", "assigned_at", "updated_at"]

    def get_student_name(self, obj):
        s = obj.student
        parts = [getattr(s, "first_name", ""), getattr(s, "last_name", "")]
        return " ".join(p for p in parts if p).strip() or str(s.id)

    def get_effective_amount(self, obj):
        return float(obj.effective_amount())
