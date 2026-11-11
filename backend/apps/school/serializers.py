from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import School, Module
from uuid import UUID
from apps.academics.serializers import GradeLevelSerializer


def absolute_media_url(request, file_field):
    """Return absolute URL for an ImageField/FileField, or None."""
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if request is not None:
        return request.build_absolute_uri(url)
    return url




class SchoolMiniSerializer(serializers.ModelSerializer):
    
    setup_complete = serializers.BooleanField(read_only=True)
    modules = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    logo = serializers.SerializerMethodField()
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


    def get_logo(self, obj):
        return absolute_media_url(self.context.get("request"), obj.logo)


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

    def to_representation(self, instance):
        try:
            from apps.school.module_seed import ensure_school_core_modules
            ensure_school_core_modules(instance)
        except Exception:
            pass
        return super().to_representation(instance)
    owner = serializers.UUIDField(source="owner.id", read_only=True)
    logo = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            "id", "owner", "name", "short_name",
            "email", "phone", "address", "city", "country",
            "website",
            "currency", "currency_symbol",
            "academic_year_start_month", "academic_year_end_month",
            "term_system", "number_of_terms",
            "grading_system", "passing_mark",
            "official_registration_number", "registration_authority", "registration_date",
            "admission_number_format",
            "admission_prefix",
            "admission_seq_padding",
            "interview_fee_enabled",
            "interview_fee_amount",
            "admission_fee_amount",
            "require_admission_fee_before_enroll", "currency_display",
            "logo", "modules", "setup_complete",
            # Payment details needed on offer letters / receipts
            "bank_name", "branch_name", "bank_account_name",
            "bank_account_number", "paybill_number", "payment_instructions",
            "created_at", "updated_at",
        ]

    def get_logo(self, obj):
        return absolute_media_url(self.context.get("request"), obj.logo)


class SchoolSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        try:
            from apps.school.module_seed import ensure_school_core_modules
            ensure_school_core_modules(instance)
        except Exception:
            pass
        return super().to_representation(instance)


    modules = ModuleSerializer(many=True, read_only=True)
    grade_levels = GradeLevelSerializer(many=True, read_only=True) 
    owner = serializers.UUIDField(source="owner.id", read_only=True)
    logo = serializers.SerializerMethodField()

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
            'admission_number_format', 'admission_prefix', 'admission_seq_padding',
            'interview_fee_enabled',
            'interview_fee_amount',
            'admission_fee_amount',
            'require_admission_fee_before_enroll',
            'created_at', 'updated_at'
        ]


    def get_logo(self, obj):
        return absolute_media_url(self.context.get("request"), obj.logo)


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

    def validate_logo(self, image):
        if image:
            from apps.core.file_validation import validate_image
            validate_image(image)
        return image

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
            'admission_number_format',
            'admission_prefix',
            'admission_seq_padding',
            'interview_fee_enabled',
            'interview_fee_amount',
            'admission_fee_amount',
            'require_admission_fee_before_enroll',
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

    def validate_website(self, value):
        if value in (None, ""):
            return ""
        return value

    def update(self, instance, validated_data):
        from django.core.exceptions import ImproperlyConfigured
        from rest_framework.exceptions import ValidationError as DRFValidationError

        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError("Request context is missing.")

        user = request.user

        # Owner, staff, or any user linked to this school may update settings
        is_member = instance.users.filter(pk=user.pk).exists()
        if instance.owner_id != getattr(user, "id", None) and not user.is_staff and not is_member:
            raise PermissionDenied("You do not have permission to update this school.")

        module_ids = validated_data.pop('module_ids', None)
        new_logo = validated_data.pop("logo", serializers.empty)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if module_ids is not None:
            instance.modules.set(module_ids)

        if new_logo is not serializers.empty:
            from apps.core.storage import CloudinaryStorage

            try:
                if new_logo is None and instance.logo:
                    try:
                        instance.logo.delete(save=False)
                    except Exception:
                        pass
                    instance.logo = None
                elif new_logo:
                    storage = CloudinaryStorage()
                    if not storage.configured:
                        raise DRFValidationError(
                            {
                                "logo": (
                                    "Logo upload requires CLOUDINARY_URL on the backend (Deplexo). "
                                    "Text fields can still be saved without a logo."
                                ),
                                "hint": "Set CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME then redeploy.",
                            }
                        )
                    if instance.logo:
                        try:
                            instance.logo.delete(save=False)
                        except Exception:
                            pass
                    instance.logo = new_logo
            except DRFValidationError:
                raise
            except Exception as exc:
                raise DRFValidationError(
                    {"logo": f"Could not process logo: {exc}"}
                ) from exc

        from apps.core.upload_context import upload_owner
        try:
            with upload_owner(instance):
                instance.save()
        except DRFValidationError:
            raise
        except ImproperlyConfigured as exc:
            raise DRFValidationError(
                {
                    "detail": str(exc),
                    "hint": "Set CLOUDINARY_URL on Deplexo, or save without changing the logo.",
                }
            ) from exc
        except OSError as exc:
            raise DRFValidationError(
                {
                    "detail": "Server could not store the uploaded file.",
                    "hint": "Set CLOUDINARY_URL on the backend host (Deplexo).",
                    "error": str(exc),
                }
            ) from exc
        except Exception as exc:
            msg = str(exc)
            raise DRFValidationError(
                {
                    "detail": "Could not save school (often logo/media storage).",
                    "error": msg[:400],
                    "hint": "Ensure CLOUDINARY_URL is set on Deplexo, or save without a new logo.",
                }
            ) from exc
        return instance
