# students/serializers.py
from rest_framework import serializers
from django.db import IntegrityError
from .models import Student, Guardian, StudentGuardian, MedicalRecord, MedicalDocument
from apps.academics.serializers import GradeLevelSerializer
from apps.school.serializers import SchoolSerializer
from apps.school.support import selected_school


# ── BASE SERIALIZERS FIRST ──────────────────────────────────────────────────

class GuardianSerializer(serializers.ModelSerializer):
    school = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Guardian
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'school': {'required': False},
        }


class StudentListSerializer(serializers.ModelSerializer):
    """Lightweight payload for students table — avoids nested school/grade trees."""
    full_name = serializers.ReadOnlyField()
    current_class = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    pathway = serializers.SerializerMethodField()
    track = serializers.SerializerMethodField()
    stream = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id",
            "school_id",
            "admission_number",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "preferred_name",
            "gender",
            "date_of_birth",
            "status",
            "boarding_status",
            "current_class",
            "section",
            "pathway",
            "track",
            "stream",
            "learner_id",
            "nationality",
            "admission_date",
            "created_at",
            "updated_at",
        ]

    def get_current_class(self, obj):
        gl = obj.current_class
        if not gl:
            return None
        return {
            "id": str(gl.id),
            "name": gl.name,
            "short_name": getattr(gl, "short_name", "") or "",
            "order": getattr(gl, "order", 0),
        }

    def _name(self, obj, attr):
        rel = getattr(obj, attr, None)
        if not rel:
            return None
        return getattr(rel, "name", None) or str(rel)

    def get_section(self, obj):
        return self._name(obj, "section")

    def get_pathway(self, obj):
        return self._name(obj, "pathway")

    def get_track(self, obj):
        return self._name(obj, "track")

    def get_stream(self, obj):
        return self._name(obj, "stream")


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    school = SchoolSerializer(read_only=True)
    current_class = GradeLevelSerializer(read_only=True)
    medical_record = serializers.PrimaryKeyRelatedField(source='student_medical_record', read_only=True)
    guardians = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'created_by',
            'admission_number'
        ]

    def get_guardians(self, obj):
        links = obj.guardians.select_related("guardian").all()
        out = []
        for link in links:
            g = link.guardian
            out.append({
                "id": str(link.id),
                "is_primary": link.is_primary,
                "guardian_id": str(g.id) if g else None,
                "full_name": getattr(g, "full_name", "") or "",
                "phone": getattr(g, "phone", "") or "",
                "email": getattr(g, "email", "") or "",
                "relationship": getattr(g, "relationship", "") or "",
                "id_number": getattr(g, "id_number", "") or "",
            })
        return out

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        try:
            url = obj.photo.url
        except Exception:
            return None
        request = self.context.get("request")
        if request and url and not str(url).startswith("http"):
            return request.build_absolute_uri(url)
        return url


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

    def validate(self, attrs):
        school = selected_school(self.context["request"])
        student = attrs.get("student", self.instance.student if self.instance else None)
        guardian = attrs.get("guardian", self.instance.guardian if self.instance else None)
        if student and student.school_id != school.id:
            raise serializers.ValidationError(
                {"student": "Student must belong to the selected school."}
            )
        if guardian and guardian.school_id != school.id:
            raise serializers.ValidationError(
                {"guardian": "Guardian must belong to the selected school."}
            )
        return attrs


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
    school = serializers.PrimaryKeyRelatedField(read_only=True)
    documents = MedicalDocumentSerializer(many=True, required=False)
    consent_by = serializers.PrimaryKeyRelatedField(
        queryset=Guardian.objects.all(),
        allow_null=True
    )

    class Meta:
        model = MedicalRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'recorded_by', 'reviewed_by']

    def validate_consent_by(self, value):
        school = selected_school(self.context["request"])
        if value and value.school_id != school.id:
            raise serializers.ValidationError(
                "Consent guardian must belong to the selected school."
            )
        return value

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
    school = serializers.PrimaryKeyRelatedField(read_only=True)
    full_name = serializers.ReadOnlyField()
    guardians = StudentGuardianSerializer(many=True, required=False)
    medical_record = MedicalRecordSerializer(source='student_medical_record', required=False)

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

    FK_NULLABLE = (
        "current_class", "section", "pathway", "track", "stream",
        "academic_year", "fee_structure",
    )

    def _clean_fk_blanks(self, validated_data):
        for field in self.FK_NULLABLE:
            if field in validated_data and validated_data[field] in ("", None):
                validated_data[field] = None
        # Profile edits must not wipe guardians / medical via nested empty writes
        validated_data.pop("guardians", None)
        validated_data.pop("student_medical_record", None)
        return validated_data

    def create(self, validated_data):
        validated_data = self._clean_fk_blanks(validated_data)
        validated_data['created_by'] = self.context['request'].user
        if not validated_data.get('admission_number'):
            school = validated_data.get('school')
            if school:
                from apps.school.models import generate_unique_admission_number
                validated_data['admission_number'] = generate_unique_admission_number(school)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._clean_fk_blanks(validated_data)
        # Flat guardian fields from edit form (not nested write)
        g_name = validated_data.pop("primary_guardian_name", None)
        g_phone = validated_data.pop("primary_guardian_phone", None)
        g_email = validated_data.pop("primary_guardian_email", None)
        g_rel = validated_data.pop("primary_guardian_relationship", None)
        g_id = validated_data.pop("primary_guardian_id_number", None)
        # These are not model fields — strip if serializer included extras
        for k in list(validated_data.keys()):
            if k.startswith("primary_guardian_"):
                validated_data.pop(k, None)

        instance = super().update(instance, validated_data)

        # Update or create primary guardian when any guardian field sent
        if any(v is not None for v in (g_name, g_phone, g_email, g_rel, g_id)):
            from .models import Guardian, StudentGuardian
            link = (
                StudentGuardian.objects.filter(student=instance, is_primary=True)
                .select_related("guardian")
                .first()
            )
            if link and link.guardian:
                g = link.guardian
                if g_name is not None:
                    g.full_name = g_name
                if g_phone is not None and str(g_phone).strip():
                    g.phone = str(g_phone).strip()
                if g_email is not None:
                    g.email = g_email
                if g_rel is not None:
                    g.relationship = g_rel
                if g_id is not None:
                    g.id_number = g_id
                g.save()
            elif g_phone or g_name:
                g = Guardian.objects.create(
                    school=instance.school,
                    full_name=g_name or "Guardian",
                    phone=str(g_phone or "unknown"),
                    email=g_email or "",
                    relationship=g_rel or "",
                    id_number=g_id or "",
                )
                StudentGuardian.objects.create(
                    student=instance, guardian=g, is_primary=True
                )
        return instance
