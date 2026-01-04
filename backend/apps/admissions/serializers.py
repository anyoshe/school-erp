from rest_framework import serializers
from .models import Application
from apps.academics.serializers import ClassSerializer

# ----------------------------
# APPLICATION SERIALIZERS
# ----------------------------

class ApplicationSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes nested class info
    """
    class_applied_name = serializers.CharField(source='class_applied.name', read_only=True)

    class Meta:
        model = Application
        fields = [
            'id',
            'first_name',
            'last_name',
            'class_applied',
            'class_applied_name',
            'status',
            'submitted_at'
        ]


class ApplicationCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For admin or admissions staff
    """
    class Meta:
        model = Application
        fields = [
            'id',
            'first_name',
            'last_name',
            'class_applied',
            'status'
        ]
