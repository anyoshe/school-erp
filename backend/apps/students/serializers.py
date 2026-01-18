from rest_framework import serializers
from django.db import IntegrityError
from .models import Student, Guardian, StudentGuardian, MedicalRecord, MedicalDocument
# from apps.academics.serializers import ClassSerializer
# from apps.transport.serializers import StudentAssignmentSerializer  # For transport link


# ----------------------------
# STUDENT SERIALIZERS
# ----------------------------

class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    school = serializers.PrimaryKeyRelatedField(read_only=True)
    # current_class = ClassSerializer(read_only=True)
    # transport_assignment = StudentAssignmentSerializer(read_only=True)  # From transport
    medical_record = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Student
        fields = '__all__'  # Use __all__ for full coverage, or list explicitly if needed
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'fee_balance']

class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = ['id', 'admission_date', 'created_at', 'updated_at', 'fee_balance', 'created_by']
        extra_kwargs = {
            'upi_number': {'required': False},
            'photo': {'required': False},
            'alumni': {'read_only': True},
        }

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

# ----------------------------
# GUARDIAN SERIALIZERS
# ----------------------------

class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'school': {'required': False},
        }

# ----------------------------
# STUDENT-GUARDIAN SERIALIZERS
# ----------------------------

class StudentGuardianSerializer(serializers.ModelSerializer):
    guardian = GuardianSerializer()

    class Meta:
        model = StudentGuardian
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class LinkExistingGuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentGuardian
        fields = ['student', 'guardian', 'relationship', 'is_primary', 'is_emergency_contact', 'has_pickup_permission', 'has_legal_custody', 'preferred_contact_method']

# ----------------------------
# MEDICAL SERIALIZERS
# ----------------------------

class MedicalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalDocument
        fields = '__all__'
        read_only_fields = ['id', 'uploaded_at', 'uploaded_by']

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        return super().create(validated_data)

class MedicalRecordSerializer(serializers.ModelSerializer):
    documents = MedicalDocumentSerializer(many=True, read_only=True)
    consent_by = serializers.PrimaryKeyRelatedField(read_only=True)
    recorded_by = serializers.PrimaryKeyRelatedField(read_only=True)
    reviewed_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = MedicalRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class MedicalRecordCreateUpdateSerializer(serializers.ModelSerializer):
    documents = MedicalDocumentSerializer(many=True, required=False)
    consent_by = serializers.PrimaryKeyRelatedField(queryset=Guardian.objects.all(), allow_null=True)

    class Meta:
        model = MedicalRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'recorded_by', 'reviewed_by']

    def create(self, validated_data):
        documents_data = validated_data.pop('documents', [])
        validated_data['recorded_by'] = self.context['request'].user
        instance = super().create(validated_data)
        for doc_data in documents_data:
            MedicalDocument.objects.create(medical_record=instance, **doc_data)
        return instance

    def update(self, validated_data):
        documents_data = validated_data.pop('documents', [])
        validated_data['reviewed_by'] = self.context['request'].user
        instance = super().update(instance, validated_data)
        for doc_data in documents_data:
            MedicalDocument.objects.create(medical_record=instance, **doc_data)
        return instance