from rest_framework import serializers
from .models import Report
from apps.accounts.serializers import UserSerializer

# ----------------------------
# REPORT SERIALIZERS
# ----------------------------

class ReportSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes creator info
    """
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = Report
        fields = [
            'id',
            'name',
            'description',
            'generated_at',
            'created_by',
            'created_by_email'
        ]


class ReportCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For admin/staff to generate or edit reports
    """
    class Meta:
        model = Report
        fields = [
            'id',
            'name',
            'description',
            'created_by'
        ]
