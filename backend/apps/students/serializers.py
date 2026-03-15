# students/serializers.py
from rest_framework import serializers
from django.db import IntegrityError
from .models import Student, Guardian, StudentGuardian, MedicalRecord, MedicalDocument
from apps.academics.serializers import GradeLevelSerializer
from apps.school.serializers import SchoolSerializer


# ── BASE SERIALIZERS FIRST ──────────────────────────────────────────────────

class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'school': {'required': False},
        }


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    school = SchoolSerializer(read_only=True)
    current_class = GradeLevelSerializer(read_only=True)
    medical_record = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'created_by',
            'admission_number'
        ]


# ── NESTED SERIALIZERS (AFTER BASE) ─────────────────────────────────────────

class StudentGuardianSerializer(serializers.ModelSerializer):
    guardian = GuardianSerializer(read_only=True)

    class Meta:
        model = StudentGuardian
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class LinkExistingGuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentGuardian
        fields = [
            'student', 'guardian', 'is_primary', 'is_emergency_contact',
            'has_pickup_permission', 'has_legal_custody', 'preferred_contact_method'
        ]


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
    consent_by = GuardianSerializer(read_only=True)
    recorded_by = serializers.StringRelatedField(read_only=True)
    reviewed_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = MedicalRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class MedicalRecordCreateUpdateSerializer(serializers.ModelSerializer):
    documents = MedicalDocumentSerializer(many=True, required=False)
    consent_by = serializers.PrimaryKeyRelatedField(
        queryset=Guardian.objects.all(),
        allow_null=True
    )

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

    def update(self, instance, validated_data):
        documents_data = validated_data.pop('documents', [])
        validated_data['reviewed_by'] = self.context['request'].user
        instance = super().update(instance, validated_data)
        for doc_data in documents_data:
            MedicalDocument.objects.create(medical_record=instance, **doc_data)
        return instance


# ── STUDENT CREATE/UPDATE (LAST, can reference others) ──────────────────────

class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    guardians = StudentGuardianSerializer(many=True, required=False)
    medical_record = MedicalRecordSerializer(required=False)

    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = [
            'id', 'admission_date', 'created_at', 'updated_at',
            'created_by', 'admission_number'
        ]
        extra_kwargs = {
            'photo': {'required': False},
            'alumni': {'read_only': True},
        }

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        # Auto-generate admission_number if missing
        if not validated_data.get('admission_number'):
            school = validated_data.get('school')
            if school:
                from apps.school.models import generate_unique_admission_number
                validated_data['admission_number'] = generate_unique_admission_number(school)
        return super().create(validated_data)