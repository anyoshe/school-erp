# admissions/serializers.py
from rest_framework import serializers
from .models import Application, ApplicationDocument, AdmissionFeePayment
from apps.academics.serializers import GradeLevelSerializer

class ApplicationDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationDocument
        fields = ['id', 'file', 'description', 'uploaded_at']

class AdmissionFeePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionFeePayment
        fields = ['id', 'amount', 'payment_date', 'payment_method', 'receipt_number']

class ApplicationSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes nested class, documents, payments
    """
    class_applied = GradeLevelSerializer(read_only=True)
    documents = ApplicationDocumentSerializer(many=True, read_only=True)
    fee_payments = AdmissionFeePaymentSerializer(many=True, read_only=True)

# Optional: Add read-only computed fields for convenience
    full_name = serializers.CharField(source='__str__', read_only=True)
    application_age_days = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = Application
        fields = [
            'id', 'admission_number', 'first_name', 'last_name', 'gender', 'date_of_birth',
            'class_applied', 'parent_name', 'parent_phone', 'parent_email', 'address',
            'previous_school', 'nationality', 'religion', 'category', 'status',
            'submitted_at', 'admission_date', 'notes', 'student', 'documents', 'fee_payments',
            'created_at', 'updated_at'
        ]

class ApplicationCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: Supports file uploads for documents
    """
    documents = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False
    )
    fee_payments = AdmissionFeePaymentSerializer(many=True, required=False)  # For adding payments

    class Meta:
        model = Application
        fields = [
            'id', 'admission_number', 'first_name', 'last_name', 'gender', 'date_of_birth',
            'class_applied', 'parent_name', 'parent_phone', 'parent_email', 'address',
            'previous_school', 'nationality', 'religion', 'category', 'status',
            'admission_date', 'notes', 'documents', 'fee_payments'
        ]
        extra_kwargs = {
            # Make new fields optional
            'gender': {'required': False}, 'date_of_birth': {'required': False},
            'parent_name': {'required': False}, 'parent_phone': {'required': False},
            'parent_email': {'required': False, 'allow_blank': True},
            'address': {'required': False, 'allow_blank': True},
            'previous_school': {'required': False, 'allow_blank': True},
            'nationality': {'required': False, 'allow_blank': True},
            'religion': {'required': False, 'allow_blank': True},
            'category': {'required': False, 'allow_blank': True},
            'admission_date': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        documents = validated_data.pop('documents', [])
        fee_payments = validated_data.pop('fee_payments', [])
        application = Application.objects.create(**validated_data)
        
        for file in documents:
            ApplicationDocument.objects.create(application=application, file=file)
        
        for payment_data in fee_payments:
            AdmissionFeePayment.objects.create(application=application, **payment_data)
        
        return application

    def update(self, instance, validated_data):
        documents = validated_data.pop('documents', [])
        fee_payments = validated_data.pop('fee_payments', [])
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        for file in documents:
            ApplicationDocument.objects.create(application=instance, file=file)
        
        for payment_data in fee_payments:
            AdmissionFeePayment.objects.create(application=instance, **payment_data)
        
        return instance