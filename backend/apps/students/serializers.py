from rest_framework import serializers
from django.db import IntegrityError
from .models import Student, Guardian, StudentGuardian, MedicalRecord
from apps.academics.serializers import ClassSerializer
from django.db.models import Q
# ----------------------------
# STUDENT SERIALIZERS
# ----------------------------

class StudentSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes current class info and guardians
    """
    # guardians = serializers.StringRelatedField(many=True, source='studentguardian_set', read_only=True)
    
    current_class = ClassSerializer(read_only=True) 

    class Meta:
        model = Student
        fields = [
            'id',
            'admission_number',
            'first_name',
            'last_name',
            'gender',
            'date_of_birth',
            'current_class',
            'status',
            'created_at',
            'updated_at',
            # 'guardians',
        ]


class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For adding or editing student profiles
    """
    class Meta:
        model = Student
        fields = [
            'id',
            'admission_number',
            'first_name',
            'last_name',
            'gender',
            'date_of_birth',
            'current_class',
            'status',
        ]


# ----------------------------
# GUARDIAN SERIALIZERS
# ----------------------------

class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = [
            'id',
            'full_name',
            'phone',
            'email',
            'address',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
         # Add this to make fields not required for updates
        extra_kwargs = {
            'full_name': {'required': False},
            'phone': {'required': False},
            'email': {'allow_blank': True, 'required': False},
            'address': {'allow_blank': True, 'required': False},
        }

class StudentGuardianSerializer(serializers.ModelSerializer):
    guardian = GuardianSerializer()
    student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())

    class Meta:
        model = StudentGuardian
        fields = [
            'id', 'student', 'guardian', 'relationship',
            'is_primary', 'is_emergency_contact', 'has_pickup_permission',
            'has_legal_custody', 'preferred_contact_method',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        validators = []  # We handle manually

   
    def validate(self, data):
        """
        Custom validation to check for duplicate guardian-student links
        Only for CREATE, not for UPDATE
        """
        # Skip validation for updates
        if self.instance is not None:
            return data
        
        student = data.get('student')
        guardian_data = data.get('guardian')
        
        if guardian_data and 'phone' in guardian_data:
            # Check if this guardian already exists
            existing_guardian = Guardian.objects.filter(
                phone=guardian_data['phone']
            ).first()
            
            if existing_guardian:
                # Check if this guardian is already linked to this student
                existing_link = StudentGuardian.objects.filter(
                    student=student,
                    guardian=existing_guardian
                ).first()
                
                if existing_link:
                    raise serializers.ValidationError({
                        "detail": f"This guardian is already linked to student {student.admission_number}.",
                        "link_id": existing_link.id
                    })
                
                # Guardian exists but NOT linked to this student
                # Return special error to notify frontend - DO NOT LINK AUTOMATICALLY
                raise serializers.ValidationError({
                    "guardian_exists": True,
                    "message": f"A guardian with phone {guardian_data['phone']} already exists in the system.",
                    "existing_guardian": {
                        "id": str(existing_guardian.id),
                        "full_name": existing_guardian.full_name,
                        "phone": existing_guardian.phone,
                        "email": existing_guardian.email,
                        "address": existing_guardian.address,
                    }
                })
        
        return data

    def create(self, validated_data):
        guardian_data = validated_data.pop('guardian')
        phone = guardian_data.get('phone')

        # Check if guardian with this phone already exists
        # This should ONLY reach here if validation passed (no duplicate found)
        existing_guardian = Guardian.objects.filter(phone=phone).first()

        if existing_guardian:
            # This should NEVER happen if validation worked properly
            # But just in case, return an error
            raise serializers.ValidationError({
                "guardian_exists": True,
                "message": f"A guardian with phone {phone} already exists. Please use the linking API instead.",
                "existing_guardian": {
                    "id": str(existing_guardian.id),
                    "full_name": existing_guardian.full_name,
                }
            })
        
        # If no existing guardian, create new guardian and link
        student = validated_data.pop('student', None)
        if not student:
            raise serializers.ValidationError({
                "detail": "Student is required."
            })
            
        guardian = Guardian.objects.create(**guardian_data)
        try:
            return StudentGuardian.objects.create(
                student=student,
                guardian=guardian,
                **validated_data
            )
        except IntegrityError:
            # Clean up the guardian we just created
            guardian.delete()
            raise serializers.ValidationError({
                "detail": "Failed to create guardian link. Please try again."
            })

    def update(self, instance, validated_data):
        guardian_data = validated_data.pop('guardian', None)
        if guardian_data:
            guardian = instance.guardian
            phone = guardian_data.get('phone')
            if phone and phone != guardian.phone:
                # If phone changed, check if new phone already exists
                existing_guardian = Guardian.objects.filter(phone=phone).exclude(id=guardian.id).first()
                if existing_guardian:
                    raise serializers.ValidationError({
                        "guardian_exists": True,  # Make this a boolean
                        "message": f"A guardian with phone {phone} already exists.",
                        "existing_guardian": {
                            "id": str(existing_guardian.id),
                            "full_name": existing_guardian.full_name,
                            "phone": existing_guardian.phone,
                        },
                        "phone": ["This phone number is already in use by another guardian."]
                    })
            
            # Only update fields that are provided (not None)
            for attr, value in guardian_data.items():
                if value is not None:
                    setattr(guardian, attr, value)
            guardian.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

# Add this new serializer for linking existing guardians
class LinkExistingGuardianSerializer(serializers.ModelSerializer):
    """
    Serializer specifically for linking EXISTING guardians to students
    This is called when user confirms they want to link an existing guardian
    """
    student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())
    guardian = serializers.PrimaryKeyRelatedField(queryset=Guardian.objects.all())
    
    class Meta:
        model = StudentGuardian
        fields = [
            'id', 'student', 'guardian', 'relationship',
            'is_primary', 'is_emergency_contact', 'has_pickup_permission',
            'has_legal_custody', 'preferred_contact_method',
        ]
    
    def validate(self, data):
        student = data.get('student')
        guardian = data.get('guardian')
        
        # Check if already linked
        if StudentGuardian.objects.filter(student=student, guardian=guardian).exists():
            raise serializers.ValidationError({
                "detail": "This guardian is already linked to this student."
            })
        return data
    
    def create(self, validated_data):
        try:
            return StudentGuardian.objects.create(**validated_data)
        except IntegrityError:
            raise serializers.ValidationError({
                "detail": "Failed to link guardian. Please try again."
            })

# ----------------------------
# MEDICAL RECORD SERIALIZERS
# ----------------------------

class MedicalRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.__str__', read_only=True)

    class Meta:
        model = MedicalRecord
        fields = [
            'id',
            'student',
            'student_name',
            'allergies',
            'conditions',
            'immunization_notes',
            'last_visit'
        ]


class MedicalRecordCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalRecord
        fields = [
            'id',
            'student',
            'allergies',
            'conditions',
            'immunization_notes',
            'last_visit'
        ]