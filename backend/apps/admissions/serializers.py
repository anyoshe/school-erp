# admissions/serializers.py
import hashlib
from rest_framework import serializers
from .models import Application, ApplicationDocument, AdmissionFeePayment, ApplicationCharge
from apps.academics.serializers import GradeLevelSerializer
from apps.school.models import School
from apps.school.serializers import SchoolSerializer
from apps.students.models import Student


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


class ApplicationChargeSerializer(serializers.ModelSerializer):
    is_satisfied = serializers.BooleanField(read_only=True)

    class Meta:
        model = ApplicationCharge
        fields = [
            "id",
            "charge_type",
            "policy",
            "list_amount",
            "discount_amount",
            "amount_due",
            "amount_paid",
            "waiver_reason",
            "notes",
            "decision_made",
            "is_satisfied",
            "updated_at",
        ]
        read_only_fields = ["updated_at", "is_satisfied"]


class ApplicationSerializer(serializers.ModelSerializer):
    """
    Detailed read-only serializer - used for list/retrieve
    """
    class_applied = GradeLevelSerializer(read_only=True)
    documents = ApplicationDocumentSerializer(many=True, read_only=True)
    fee_payments = AdmissionFeePaymentSerializer(many=True, read_only=True)
    charges = ApplicationChargeSerializer(many=True, read_only=True)
    photo = serializers.ImageField(read_only=True)
    school = SchoolSerializer(read_only=True)

    # Computed read-only fields
    full_name = serializers.SerializerMethodField()
    guardian_contact = serializers.SerializerMethodField()
    created_by = serializers.StringRelatedField(read_only=True)
    class Meta:
        model = Application
        fields = [
            'id',
            'school',               # Now included
            'admission_number',
            'learner_id',
            'disability',
            'entry_exam_id',
            'entry_exam_year',
            'first_name',
            'middle_name',
            'last_name',
            'preferred_name',
            'full_name',
            'gender',
            'date_of_birth',
            'nationality',
            'passport_number', 'birth_certificate_number',
            'region',
            'district',
            'address',
            'religion',
            'category',
            'previous_school',
            'class_applied',
            'primary_guardian_name',
            'primary_guardian_phone',
            'primary_guardian_email',
            'primary_guardian_relationship',
            'primary_guardian_id_number', 'secondary_guardian_id_number', 'secondary_guardian_relationship', 'secondary_guardian_email', 'secondary_guardian_phone', 'secondary_guardian_name',
            'guardian_contact',
            'placement_type',              
            'blood_group',                 
            'allergies',                   
            'chronic_conditions',          
            'emergency_contact_name',     
            'emergency_contact_phone',     
            'emergency_relationship',     
            'status',
            'submitted_at',
            'admission_date',
            'notes',
            'documents',
            'photo',
            'fee_payments', 'charges',
            'student',
            'created_by',
            'updated_at',
            'interview_date',
            'interview_time',
            'interview_venue',
            'interview_contact_person',
            'interview_instructions',
            'interview_completed_at',
            'interview_outcome',
            'interview_score',
            'interview_comments',
            'interviewer_name',
            'accepted_at',
            'acceptance_notes',
            'accepted_at',
            'acceptance_notes',
        ]
        read_only_fields = [
            'id', 'admission_number', 'submitted_at', 'student',
            'created_at', 'updated_at', 'school', 'photo','accepted_at',
            'acceptance_notes',
            'accepted_at',
            'acceptance_notes',
        ]

    def get_full_name(self, obj):
        names = [obj.first_name, obj.middle_name, obj.last_name]
        return ' '.join(filter(None, names)).strip() or obj.first_name

    def get_guardian_contact(self, obj):
        if obj.primary_guardian_name:
            return f"{obj.primary_guardian_name} ({obj.primary_guardian_phone})"
        return None


class ApplicationCreateUpdateSerializer(serializers.ModelSerializer):
    documents = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    photo = serializers.ImageField(required=False, allow_null=True)
    

    class Meta:
        model = Application
        fields = [
            'id',
            'first_name', 'middle_name', 'last_name', 'preferred_name',
            'gender', 'date_of_birth', 'nationality', 'passport_number', 'birth_certificate_number',
            'class_applied',
            'primary_guardian_name', 'primary_guardian_phone',
            'primary_guardian_email', 'primary_guardian_relationship',
            'primary_guardian_id_number',
            'address', 'region', 'district',
            'previous_school', 'religion', 'category', 'placement_type',
            'blood_group', 'allergies', 'chronic_conditions', 'disability',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_relationship',
            'notes', 'status', 'admission_date',
            'rejection_reason', 'internal_notes',
            'school',  # ← keep this so frontend can send it
            'documents', 'photo',
            'interview_date',
            'interview_time',
            'interview_venue',
            'interview_contact_person',
            'interview_instructions',
            'interview_completed_at',
            'interview_outcome',
            'interview_score',
            'interview_comments',
            'interviewer_name',
            'accepted_at',
            'acceptance_notes',
            'accepted_at',
            'acceptance_notes',
        ]
        read_only_fields = ['id']

    extra_kwargs = {
        # Staff create: school set in perform_create from X-School-ID
        'school': {'required': False, 'allow_null': True},
        'middle_name':          {'required': False, 'allow_blank': True},
        'preferred_name':       {'required': False, 'allow_blank': True},
        'nationality':          {'required': False, 'allow_blank': True},
        'passport_number':      {'required': False, 'allow_blank': True},
        'address':              {'required': False, 'allow_blank': True},
        'region':               {'required': False, 'allow_blank': True},
        'district':             {'required': False, 'allow_blank': True},
        'previous_school':      {'required': False, 'allow_blank': True},
        'religion':             {'required': False, 'allow_blank': True},
        'category':             {'required': False, 'allow_blank': True},
        'allergies':            {'required': False, 'allow_blank': True},
        'chronic_conditions':   {'required': False, 'allow_blank': True},
        'disability':           {'required': False, 'allow_blank': True},
        'emergency_contact_name':    {'required': False, 'allow_blank': True},
        'emergency_contact_phone':   {'required': False, 'allow_blank': True},
        'emergency_relationship':    {'required': False, 'allow_blank': True},
        'primary_guardian_id_number': {'required': False, 'allow_blank': True},
        'notes':                {'required': False, 'allow_blank': True},
        'school':               {'required': False},  # set by perform_create/update from tenant
    }

    def validate(self, data):
        """
        On partial updates (e.g. only status), merge with the existing instance
        so required-field checks do not fail when fields were already saved.
        """
        status = data.get("status")
        if status is None and self.instance is not None:
            status = self.instance.status

        if status in [Application.Status.SUBMITTED, Application.Status.UNDER_REVIEW]:
            required = [
                "first_name",
                "last_name",
                "class_applied",
                "primary_guardian_name",
                "primary_guardian_phone",
            ]
            missing = []
            for field in required:
                if field in data:
                    value = data.get(field)
                elif self.instance is not None:
                    value = getattr(self.instance, field, None)
                else:
                    value = None
                if not value:
                    missing.append(field)
            if missing:
                raise serializers.ValidationError(
                    {"detail": f"Required for submission: {', '.join(missing)}"}
                )
        return data

    def compute_checksum(self, file): 
        hasher = hashlib.sha256()
        for chunk in file.chunks():
            hasher.update(chunk)
        return hasher.hexdigest()

    def create(self, validated_data):
        documents_files = validated_data.pop('documents', [])
        for key in (
            "secondary_guardian_name",
            "secondary_guardian_phone",
            "secondary_guardian_relationship",
            "secondary_guardian_id_number",
        ):
            if validated_data.get(key) is None:
                validated_data[key] = ""
        application = Application.objects.create(**validated_data)

        for file in documents_files:
            # Change this line
            checksum = self.compute_checksum(file) 

            ApplicationDocument.objects.get_or_create(
                application=application,
                checksum=checksum,
                defaults={
                    "file": file,
                    "description": file.name
                }
            )
        return application



    def update(self, instance, validated_data):
        documents_files = validated_data.pop('documents', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        for file in documents_files:
            # Change this line
            checksum = self.compute_checksum(file)

            ApplicationDocument.objects.get_or_create(
                application=instance,
                checksum=checksum,
                defaults={
                    "file": file,
                    "description": file.name
                }
            )

        return instance

# Optional: Minimal serializer for list view (faster)
class ApplicationListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    class_applied_name = serializers.CharField(
        source="class_applied.name", read_only=True, default=""
    )

    class Meta:
        model = Application
        fields = [
            "id",
            "admission_number",
            "full_name",
            "first_name",
            "last_name",
            "status",
            "status_display",
            "class_applied",
            "class_applied_name",
            "submitted_at",
            "school",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.middle_name or ''} {obj.last_name}".strip()
