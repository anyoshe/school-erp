from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import School, Module
from uuid import UUID



class SchoolMiniSerializer(serializers.ModelSerializer):
    
    setup_complete = serializers.BooleanField(read_only=True)
    modules = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    logo = serializers.ImageField(read_only=True, allow_null=True)
    currency = serializers.CharField(read_only=True)
    owner = serializers.UUIDField(source="owner.id", read_only=True)
    class Meta:
        model = School
        fields = [
            'id',
            'owner',  
            'name',
            'short_name',           
            'setup_complete',      
            'logo',                 
            'currency',            
            'modules'             
        ]

class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['id', 'name', 'code']


class SchoolSerializer(serializers.ModelSerializer):
    modules = ModuleSerializer(many=True, read_only=True)
    owner = serializers.UUIDField(source="owner.id", read_only=True)
    class Meta:
        model = School
        fields = [
            'id', 'owner', 'name', 'email', 'phone', 'address', 'city', 'country', 'currency', 
            'modules',
            'logo',
            'created_at', 'updated_at'
        ]


class SchoolCreateUpdateSerializer(serializers.ModelSerializer):
    module_ids = serializers.ListField(
        # child=serializers.UUIDField(),
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    setup_complete = serializers.BooleanField(required=False, write_only=False)
    modules = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = School
        fields = [
            'id', 'name', 'short_name', 'email', 'phone', 'address', 'city', 'country',
            'website', 'currency', 'academic_year_start_month', 'academic_year_end_month',
            'term_system', 'number_of_terms', 'grading_system', 'passing_mark',
            'logo', 'official_registration_number',
            'registration_authority', 'registration_date',
            'module_ids',
            'modules',
            'setup_complete',
        ]
        extra_kwargs = {
            'logo': {'required': False, 'allow_null': True},
            # Allow module_ids as extra field to prevent rejection
            'module_ids': {'required': False},
            'setup_complete': {'required': False},
        }

    def validate_module_ids(self, value):
        invalid_ids = [mid for mid in value if not Module.objects.filter(id=mid).exists()]
        if invalid_ids:
            raise serializers.ValidationError(f"Invalid module IDs: {invalid_ids}")
        return value
    
    def to_internal_value(self, data):
        print("→→→ to_internal_value() called")
        print("   Incoming data (from request.data):", dict(data))
        print("   setup_complete present?", 'setup_complete' in data)

        validated = super().to_internal_value(data)

        print("   After validation → validated_data keys:", list(validated.keys()))
        print("   setup_complete in validated_data?", 'setup_complete' in validated)
        print("←←←")

        return validated

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError("Request context is missing.")

        user = request.user

        # Security: Only owner or admin can update
        if instance.owner != user and not user.is_staff:
            raise PermissionDenied("You do not have permission to update this school.")
        print("→→→ UPDATE METHOD")
        print("   validated_data keys:", list(validated_data.keys()))

        if 'setup_complete' in validated_data:
            print("   setup_complete VALUE received:", validated_data['setup_complete'])
        else:
            print("   !!! setup_complete NOT PRESENT in validated_data !!!")

         
        # Pop module_ids EARLY
        module_ids = validated_data.pop('module_ids', None)
        print("DEBUG: PATCH received module_ids:", module_ids)  # ← Add this for debug

        # Update normal fields
        for attr, value in validated_data.items():
            if attr == 'logo':
                if value is None and instance.logo:
                    instance.logo.delete(save=False)
                elif value:
                    if instance.logo:
                        instance.logo.delete(save=False)
                    setattr(instance, attr, value)
            else:
                setattr(instance, attr, value)

        # Apply modules if provided
        if module_ids is not None:
            instance.modules.set(module_ids)

        instance.save()
        return instance