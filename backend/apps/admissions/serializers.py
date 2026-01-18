# # admissions/serializers.py
# from rest_framework import serializers
# from .models import Application, ApplicationDocument, AdmissionFeePayment
# from apps.academics.serializers import GradeLevelSerializer

# class ApplicationDocumentSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = ApplicationDocument
#         fields = ['id', 'file', 'description', 'uploaded_at']

# class AdmissionFeePaymentSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = AdmissionFeePayment
#         fields = ['id', 'amount', 'payment_date', 'payment_method', 'receipt_number']

# class ApplicationSerializer(serializers.ModelSerializer):
#     """
#     READ-ONLY: Includes nested class, documents, payments
#     """
#     class_applied = GradeLevelSerializer(read_only=True)
#     documents = ApplicationDocumentSerializer(many=True, read_only=True)
#     fee_payments = AdmissionFeePaymentSerializer(many=True, read_only=True)

# # Optional: Add read-only computed fields for convenience
#     full_name = serializers.CharField(source='__str__', read_only=True)
#     application_age_days = serializers.SerializerMethodField(read_only=True)
#     class Meta:
#         model = Application
#         fields = [
#             'id', 'admission_number', 'first_name', 'last_name', 'gender', 'date_of_birth',
#             'class_applied', 'parent_name', 'parent_phone', 'parent_email', 'address',
#             'previous_school', 'nationality', 'religion', 'category', 'status',
#             'submitted_at', 'admission_date', 'notes', 'student', 'documents', 'fee_payments',
#             'created_at', 'updated_at'
#         ]

# class ApplicationCreateUpdateSerializer(serializers.ModelSerializer):
#     """
#     CREATE / UPDATE: Supports file uploads for documents
#     """
#     documents = serializers.ListField(
#         child=serializers.FileField(),
#         write_only=True,
#         required=False
#     )
#     fee_payments = AdmissionFeePaymentSerializer(many=True, required=False)  # For adding payments

#     class Meta:
#         model = Application
#         fields = [
#             'id', 'admission_number', 'first_name', 'last_name', 'gender', 'date_of_birth',
#             'class_applied', 'parent_name', 'parent_phone', 'parent_email', 'address',
#             'previous_school', 'nationality', 'religion', 'category', 'status',
#             'admission_date', 'notes', 'documents', 'fee_payments'
#         ]
#         extra_kwargs = {
#             # Make new fields optional
#             'gender': {'required': False}, 'date_of_birth': {'required': False},
#             'parent_name': {'required': False}, 'parent_phone': {'required': False},
#             'parent_email': {'required': False, 'allow_blank': True},
#             'address': {'required': False, 'allow_blank': True},
#             'previous_school': {'required': False, 'allow_blank': True},
#             'nationality': {'required': False, 'allow_blank': True},
#             'religion': {'required': False, 'allow_blank': True},
#             'category': {'required': False, 'allow_blank': True},
#             'admission_date': {'required': False},
#             'notes': {'required': False, 'allow_blank': True},
#         }

#     def create(self, validated_data):
#         documents = validated_data.pop('documents', [])
#         fee_payments = validated_data.pop('fee_payments', [])
#         application = Application.objects.create(**validated_data)
        
#         for file in documents:
#             ApplicationDocument.objects.create(application=application, file=file)
        
#         for payment_data in fee_payments:
#             AdmissionFeePayment.objects.create(application=application, **payment_data)
        
#         return application

#     def update(self, instance, validated_data):
#         documents = validated_data.pop('documents', [])
#         fee_payments = validated_data.pop('fee_payments', [])
        
#         for attr, value in validated_data.items():
#             setattr(instance, attr, value)
#         instance.save()
        
#         for file in documents:
#             ApplicationDocument.objects.create(application=instance, file=file)
        
#         for payment_data in fee_payments:
#             AdmissionFeePayment.objects.create(application=instance, **payment_data)
        
#         return instance

# admissions/serializers.py
from rest_framework import serializers
from .models import Application, ApplicationDocument, AdmissionFeePayment
from apps.academics.serializers import GradeLevelSerializer
from apps.school.models import School


class ApplicationDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationDocument
        fields = ['id', 'file', 'description', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class AdmissionFeePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionFeePayment
        fields = ['id', 'amount', 'payment_date', 'payment_method', 'receipt_number']
        read_only_fields = ['payment_date']


class ApplicationSerializer(serializers.ModelSerializer):
    """
    Detailed read-only serializer - used for list/retrieve
    """
    class_applied = GradeLevelSerializer(read_only=True)
    documents = ApplicationDocumentSerializer(many=True, read_only=True)
    fee_payments = AdmissionFeePaymentSerializer(many=True, read_only=True)

    # Computed read-only fields
    full_name = serializers.SerializerMethodField()
    guardian_contact = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            'id',
            'school',               # Now included
            'admission_number',
            'first_name',
            'middle_name',
            'last_name',
            'preferred_name',
            'full_name',
            'gender',
            'date_of_birth',
            'nationality',
            'passport_number',
            'county',
            'sub_county',
            'address',
            'religion',
            'category',
            'previous_school',
            'class_applied',
            'primary_guardian_name',
            'primary_guardian_phone',
            'primary_guardian_email',
            'primary_guardian_relationship',
            'guardian_contact',
            'status',
            'submitted_at',
            'admission_date',
            'notes',
            'documents',
            'fee_payments',
            'student',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'admission_number', 'submitted_at', 'student',
            'created_at', 'updated_at', 'school'
        ]

    def get_full_name(self, obj):
        names = [obj.first_name, obj.middle_name, obj.last_name]
        return ' '.join(filter(None, names)).strip() or obj.first_name

    def get_guardian_contact(self, obj):
        if obj.primary_guardian_name:
            return f"{obj.primary_guardian_name} ({obj.primary_guardian_phone})"
        return None


class ApplicationCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Create & Update serializer - handles nested writes for documents & payments
    """
    documents = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    fee_payments = AdmissionFeePaymentSerializer(many=True, required=False)

    class Meta:
        model = Application
        fields = [
            'first_name',
            'middle_name',
            'last_name',
            'preferred_name',
            'gender',
            'date_of_birth',
            'nationality',
            'passport_number',
            'county',
            'sub_county',
            'address',
            'religion',
            'category',
            'previous_school',
            'class_applied',
            'primary_guardian_name',
            'primary_guardian_phone',
            'primary_guardian_email',
            'primary_guardian_relationship',
            'status',
            'notes',
            'admission_date',
            'documents',
            'fee_payments',
        ]
        extra_kwargs = {
            'middle_name': {'required': False, 'allow_blank': True},
            'preferred_name': {'required': False, 'allow_blank': True},
            'gender': {'required': False},
            'date_of_birth': {'required': False},
            'nationality': {'required': False, 'allow_blank': True},
            'passport_number': {'required': False, 'allow_blank': True},
            'county': {'required': False, 'allow_blank': True},
            'sub_county': {'required': False, 'allow_blank': True},
            'address': {'required': False, 'allow_blank': True},
            'religion': {'required': False, 'allow_blank': True},
            'category': {'required': False, 'allow_blank': True},
            'previous_school': {'required': False, 'allow_blank': True},
            'primary_guardian_name': {'required': False, 'allow_blank': True},
            'primary_guardian_phone': {'required': False, 'allow_blank': True},
            'primary_guardian_email': {'required': False, 'allow_blank': True},
            'primary_guardian_relationship': {'required': False, 'allow_blank': True},
            'status': {'required': False},
            'admission_date': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def validate(self, data):
        # Optional: add custom validation, e.g. require guardian info if status=SUBMITTED
        if data.get('status') == Application.Status.SUBMITTED:
            if not data.get('primary_guardian_name') or not data.get('primary_guardian_phone'):
                raise serializers.ValidationError("Primary guardian name and phone are required when submitting.")
        return data

    def create(self, validated_data):
        documents_data = validated_data.pop('documents', [])
        payments_data = validated_data.pop('fee_payments', [])

        # Auto-set school from request context
        request = self.context['request']
        validated_data['school'] = request.user.school  # Assuming user has school attribute

        application = Application.objects.create(**validated_data)

        # Handle documents
        for file in documents_data:
            ApplicationDocument.objects.create(application=application, file=file)

        # Handle payments
        for payment_data in payments_data:
            AdmissionFeePayment.objects.create(application=application, **payment_data)

        return application

    def update(self, instance, validated_data):
        documents_data = validated_data.pop('documents', [])
        payments_data = validated_data.pop('fee_payments', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        # Add new documents (not replacing old ones)
        for file in documents_data:
            ApplicationDocument.objects.create(application=instance, file=file)

        # Add new payments
        for payment_data in payments_data:
            AdmissionFeePayment.objects.create(application=instance, **payment_data)

        return instance


# Optional: Minimal serializer for list view (faster)
class ApplicationListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display')

    class Meta:
        model = Application
        fields = [
            'id', 'admission_number', 'full_name', 'status', 'status_display',
            'class_applied', 'submitted_at', 'school'
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.middle_name or ''} {obj.last_name}".strip()