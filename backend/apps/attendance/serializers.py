from rest_framework import serializers
from .models import Attendance
from apps.accounts.serializers import UserSerializer

# ----------------------------
# ATTENDANCE SERIALIZERS
# ----------------------------

class AttendanceSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes user info and recorder info
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)
    recorded_by_email = serializers.EmailField(source='recorded_by.email', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id',
            'user',
            'user_email',
            'date',
            'status',
            'recorded_by',
            'recorded_by_email'
        ]


class AttendanceCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For marking attendance
    """
    class Meta:
        model = Attendance
        fields = [
            'id',
            'user',
            'date',
            'status',
            'recorded_by'
        ]
