from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import School, Module
from uuid import UUID
from apps.academics.serializers import GradeLevelSerializer



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
            'currency', 'currency_symbol', 'currency_display',            
            'modules'             
        ]


class PlatformSchoolSerializer(serializers.ModelSerializer):
    owner = serializers.UUIDField(source="owner.id", read_only=True, allow_null=True)

    class Meta:
        model = School
        fields = [
            "id",
            "owner",
            "name",
            "short_name",
            "email",
            "city",
            "country",
            "setup_complete",
            "created_at",
            "updated_at",
        ]


class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['id', 'name', 'code']


class SchoolSessionSerializer(serializers.ModelSerializer):
    """
    Lightweight school payload for login/session and my-schools.
    Includes modules for the sidebar — excludes heavy grade_levels tree.
    """
    modules = ModuleSerializer(many=True, read_only=True)
    owner = serializers.UUIDField(source="owner.id", read_only=True)

    class Meta:
        model = School
        fields = [
            "id", "owner", "name", "short_name",
            "email", "phone", "city", "country",
            "currency", "currency_symbol", "currency_display",
            "logo", "modules", "setup_complete",
            "created_at", "updated_at",
        ]


class SchoolSerializer(serializers.ModelSerializer):

    modules = ModuleSerializer(many=True, read_only=True)
    grade_levels = GradeLevelSerializer(many=True, read_only=True) 
    owner = serializers.UUIDField(source="owner.id", read_only=True)
    class Meta:
        model = School
        fields = [
            'id', 'owner', 'name', 'short_name',           
            'email', 'phone', 'address', 'city', 'country',
            'website',   
            'alternative_phone',                       
            'emergency_phone',                          
            'postal_address',                   
            'currency', 'currency_symbol', 'currency_display',
            'academic_year_start_month',                  
            'academic_year_end_month',
            'term_system', 'number_of_terms',
            'grading_system', 'passing_mark',
            'official_registration_number',
            'registration_authority', 'registration_date',
            'modules', 'grade_levels', 'logo',
            'bank_name', 'branch_name', 'bank_account_name', 
            'bank_account_number', 'paybill_number', 'payment_instructions',
            'created_at', 'updated_at'
        ]


class PublicSchoolSerializer(serializers.ModelSerializer):
    """Minimal school profile for public-facing pages and anonymous admissions flows."""
    class Meta:
        model = School
        fields = [
            'id',
            'name',
            'short_name',
            'slug',
            'city',
            'country',
            'website',
            'logo',
            'setup_complete',
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
            'bank_name', 'branch_name', 'bank_account_name', 
            'bank_account_number', 'paybill_number', 'payment_instructions',
            'alternative_phone',          
            'emergency_phone',
            'postal_address',
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
    
    def update(self, instance, validated_data):
        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError("Request context is missing.")

        user = request.user

        # Security: Only owner or admin can update
        if instance.owner != user and not user.is_staff:
            raise PermissionDenied("You do not have permission to update this school.")

        module_ids = validated_data.pop('module_ids', None)

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

        if module_ids is not None:
            instance.modules.set(module_ids)

        instance.save()
        return instance