# apps/academics/views.py
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
from .models import Curriculum, GradeLevel, Department
from .serializers import (
    CurriculumSerializer, CurriculumCreateUpdateSerializer,
    CurriculumTemplateSerializer,
    GradeLevelSerializer, GradeLevelLiteSerializer, GradeLevelCreateUpdateSerializer,
    DepartmentSerializer, DepartmentCreateUpdateSerializer,
)
from apps.school.models import School
from apps.school.support import accessible_school_ids, selected_school

class CurriculumTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List global curriculum templates (CBC, 8-4-4, Cambridge, ...).
    If none exist (e.g. fixture never loaded), attempt to seed from fixture once.
    """
    serializer_class = CurriculumTemplateSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Curriculum.objects.filter(is_template=True, is_active=True)
        if not qs.exists():
            try:
                from django.core.management import call_command
                from django.conf import settings
                import os
                fixture_path = os.path.join(
                    settings.BASE_DIR, "apps", "academics", "fixtures", "initial_templates.json"
                )
                if os.path.exists(fixture_path):
                    call_command("loaddata", fixture_path, verbosity=0, ignorenonexistent=True)
                    qs = Curriculum.objects.filter(is_template=True, is_active=True)
            except Exception as e:
                print(f"[templates] auto-seed failed: {e}")
        return qs


class CurriculumViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CurriculumCreateUpdateSerializer
        return CurriculumSerializer

    def get_queryset(self):
        return Curriculum.objects.filter(
            school_id__in=accessible_school_ids(self.request)
        )

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

class CopyCurriculumTemplateAPIView(APIView):
    """
    Clones a curriculum template and its associated grade levels 
    making them owned by the specific school.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        school = selected_school(request)
        school_id = school.id
        if not school_id:
            return Response({"error": "X-School-ID header required"}, status=400)

        template_id = request.data.get('template_id')
        grade_level_ids = request.data.get('grade_level_ids', [])
        department_ids = request.data.get('department_ids', [])  # ← ADD THIS
        
        if not template_id:
            return Response({"error": "template_id is required"}, status=400)
        
        template = get_object_or_404(Curriculum, pk=template_id, is_template=True)

        print(f"[COPY TEMPLATE] School: {school.name} (ID: {school_id})")
        print(f"[COPY TEMPLATE] Template: {template.name} (ID: {template_id})")
        print(f"[COPY TEMPLATE] Selected grades: {grade_level_ids}")
        print(f"[COPY TEMPLATE] Selected departments: {department_ids}")

        # 1. Clone or get existing curriculum for this school
        curriculum, created = Curriculum.objects.get_or_create(
            school=school,
            name=template.name,
            defaults={
                'short_code': template.short_code,
                'description': template.description,
                'is_active': True,
                'is_template': False,
                'term_system': template.term_system,
                'number_of_terms': template.number_of_terms,
                'grading_system': template.grading_system,
                'passing_mark': template.passing_mark,
            }
        )

        action = "Created" if created else "Found existing"
        print(f"[COPY TEMPLATE] {action} curriculum: {curriculum.name} (ID: {curriculum.id})")

        # 2. Clone Grade Levels with explicit school + curriculum linkage
        grade_qs = GradeLevel.objects.filter(curriculum=template)
        
        # If specific grades selected, filter to those
        if grade_level_ids:
            grade_qs = grade_qs.filter(pk__in=grade_level_ids)
            print(f"[COPY TEMPLATE] Filtering to {len(grade_level_ids)} selected grades")
        
        grades_created = 0
        grades_existing = 0
        
        for gl in grade_qs:
            grade, grade_created = GradeLevel.objects.get_or_create(
                school=school,              # ← CRITICAL: Explicit school ownership
                curriculum=curriculum,       # ← Link to school-specific curriculum
                name=gl.name,
                defaults={
                    'short_name': gl.short_name or '',
                    'order': gl.order,
                    'code': gl.code or '',
                    'education_level': gl.education_level,
                }
            )
            if grade_created:
                grades_created += 1
                print(f"  ✓ Created: {grade.name}")
            else:
                grades_existing += 1
                print(f"  ○ Existing: {grade.name}")

        # 3. Clone Departments (with department_ids filter)
        dept_qs = Department.objects.filter(
            Q(school__isnull=True) | Q(curriculum=template)
        )
        
        # If specific departments selected, filter to those
        if department_ids:
            dept_qs = dept_qs.filter(pk__in=department_ids)
            print(f"[COPY TEMPLATE] Filtering to {len(department_ids)} selected departments")
        
        depts_created = 0
        depts_existing = 0
        
        for dep in dept_qs:
            dept, dept_created = Department.objects.get_or_create(
                school=school,
                name=dep.name,
                defaults={
                    'short_name': dep.short_name or '',
                    'code': dep.code or '',
                    'curriculum': curriculum
                }
            )
            if dept_created:
                depts_created += 1
                print(f"  ✓ Created dept: {dept.name}")
            else:
                depts_existing += 1
                print(f"  ○ Existing dept: {dept.name}")

        # 4. Verify what was created
        final_grade_count = GradeLevel.objects.filter(school=school).count()
        final_dept_count = Department.objects.filter(school=school).count()
        
        print(f"[COPY TEMPLATE] ✅ Complete!")
        print(f"  - Grades: {grades_created} created, {grades_existing} existing, {final_grade_count} total")
        print(f"  - Departments: {depts_created} created, {depts_existing} existing, {final_dept_count} total")

        return Response({
            "success": True,
            "curriculum_id": curriculum.id,
            "curriculum_name": curriculum.name,
            "curriculum_action": "created" if created else "existing",
            "grades": {
                "created": grades_created,
                "existing": grades_existing,
                "total": final_grade_count
            },
            "departments": {
                "created": depts_created,
                "existing": depts_existing,
                "total": final_dept_count
            },
            "message": f"Successfully initialized {template.name} for {school.name}"
        }, status=201 if created else 200)


class GradeLevelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    # Dropdowns/forms need full list quickly; avoid pagination overhead
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return GradeLevelCreateUpdateSerializer
        # List: lite (id/name only). Detail: full serializer.
        # ?full=1 forces nested/counts when a page needs them.
        if self.action == "list" and self.request.query_params.get("full") != "1":
            return GradeLevelLiteSerializer
        return GradeLevelSerializer

    def get_queryset(self):
        queryset = GradeLevel.objects.all()
        curriculum_id = self.request.query_params.get('curriculum')
        is_template_only = self.request.query_params.get('school__isnull') == 'true'
        is_active = self.request.query_params.get('is_active')

        # Fix: If we want templates, ignore the school_id header
        if is_template_only:
            queryset = queryset.filter(school__isnull=True)
        else:
            queryset = queryset.filter(
                school_id__in=accessible_school_ids(self.request)
            )

        if curriculum_id:
            queryset = queryset.filter(curriculum_id=curriculum_id)
        if is_active is not None:
            # GradeLevel may not have is_active — ignore if field missing
            if hasattr(GradeLevel, "is_active"):
                queryset = queryset.filter(is_active=(str(is_active).lower() == "true"))

        # Only join what list needs
        if self.action == "list" and self.request.query_params.get("full") != "1":
            return queryset.order_by("order", "name").only(
                "id", "name", "short_name", "order", "code", "curriculum_id", "school_id"
            )

        return queryset.select_related("curriculum", "school").prefetch_related(
            "sections", "streams"
        ).order_by("order", "name")

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

    @action(detail=False, methods=['delete'], url_path='bulk-delete')
    @transaction.atomic
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        school = selected_school(request)
        if not ids:
            return Response({"detail": "Missing IDs or X-School-ID"}, status=400)

        deleted = GradeLevel.objects.filter(
            id__in=ids,
            school_id=school.id,
        ).delete()
        return Response({"detail": f"Deleted {deleted[0]} grade levels"}, status=204)


class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DepartmentCreateUpdateSerializer
        return DepartmentSerializer

    
    def get_queryset(self):
        queryset = Department.objects.all()
        is_template_only = self.request.query_params.get('school__isnull') == 'true'

        # 1. PRIORITY: If wizard is fetching global templates
        if is_template_only:
            return queryset.filter(school__isnull=True).order_by('name')

        # 2. CONTEXT: If managing a specific school
        return queryset.filter(
            school_id__in=accessible_school_ids(self.request)
        ).order_by('name')

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

class PublicGradeLevelsView(APIView):
    """
    Public endpoint for public application forms.
    Finds grades owned by the school or linked to the school's active curricula.
    """
    permission_classes = [AllowAny]

    def get(self, request, school_id):
        try:
            # Handle lookup by UUID or Slug
            school = School.objects.filter(Q(id=school_id) | Q(slug=school_id)).first()
            if not school:
                print(f"[PUBLIC GRADES] ❌ School not found: {school_id}")
                return Response({"detail": "School not found"}, status=404)

            print(f"[PUBLIC GRADES] 🏫 School: {school.name} (ID: {school.id})")

            # Fetch grade levels owned by this school
            grades = GradeLevel.objects.filter(
                Q(school=school) | Q(curriculum__school=school)
            ).distinct().order_by('order', 'name')

            print(f"[PUBLIC GRADES] Found {grades.count()} grade levels")
            
            if grades.count() == 0:
                # Debug: Check what's in the database
                all_school_grades = GradeLevel.objects.filter(school=school)
                curricula = Curriculum.objects.filter(school=school)
                print(f"[PUBLIC GRADES] DEBUG:")
                print(f"  - Direct school grades: {all_school_grades.count()}")
                print(f"  - School curricula: {curricula.count()}")
                for c in curricula:
                    c_grades = GradeLevel.objects.filter(curriculum=c)
                    print(f"    - {c.name}: {c_grades.count()} grades")

            serializer = GradeLevelSerializer(grades, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            print(f"[PUBLIC GRADES] ❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"detail": str(e)}, status=400)
        

class SchoolAcademicStatusView(APIView):
    """
    Debug endpoint to check school's academic setup status
    """
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production
    
    def get(self, request, school_id):
        try:
            school = School.objects.filter(Q(id=school_id) | Q(slug=school_id)).first()
            if not school:
                return Response({"detail": "School not found"}, status=404)
            
            curricula = Curriculum.objects.filter(school=school)
            grades = GradeLevel.objects.filter(school=school)
            departments = Department.objects.filter(school=school)
            
            return Response({
                "school": {
                    "id": str(school.id),
                    "name": school.name,
                    "slug": school.slug,
                },
                "curricula": {
                    "count": curricula.count(),
                    "items": [{"id": c.id, "name": c.name} for c in curricula]
                },
                "grade_levels": {
                    "count": grades.count(),
                    "items": [
                        {
                            "id": g.id,
                            "name": g.name,
                            "curriculum_id": g.curriculum_id,
                            "school_id": str(g.school_id)
                        } for g in grades
                    ]
                },
                "departments": {
                    "count": departments.count(),
                    "items": [{"id": d.id, "name": d.name} for d in departments]
                }
            })
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

# ---------------------------------------------------------------------------
# Academic Year / Term / Section / Stream / Subject
# ---------------------------------------------------------------------------
from rest_framework import status
from .serializers import (
    AcademicYearSerializer,
    AcademicYearCreateUpdateSerializer,
    TermSerializer,
    TermCreateUpdateSerializer,
    SectionSerializer,
    StreamSerializer,
    SubjectSerializer,
    SubjectCreateUpdateSerializer,
)
from .models import AcademicYear, Term, Section, Stream, Subject


class AcademicYearViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AcademicYearCreateUpdateSerializer
        return AcademicYearSerializer

    def get_queryset(self):
        return AcademicYear.objects.filter(
            school_id__in=accessible_school_ids(self.request)
        ).prefetch_related("terms").order_by("-start_date")

    def perform_create(self, serializer):
        school = selected_school(self.request)
        instance = serializer.save(school=school)
        # Ensure only one active year per school when activating
        if instance.is_active:
            AcademicYear.objects.filter(school=school, is_active=True).exclude(pk=instance.pk).update(is_active=False)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.is_active and instance.school_id:
            AcademicYear.objects.filter(
                school_id=instance.school_id, is_active=True
            ).exclude(pk=instance.pk).update(is_active=False)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        year = self.get_object()
        AcademicYear.objects.filter(school=year.school, is_active=True).update(is_active=False)
        year.is_active = True
        year.save(update_fields=["is_active"])
        return Response(AcademicYearSerializer(year).data)

    @action(detail=True, methods=["post"])
    def add_term(self, request, pk=None):
        year = self.get_object()
        ser = TermCreateUpdateSerializer(data={**request.data, "academic_year": year.pk})
        ser.is_valid(raise_exception=True)
        term = ser.save()
        return Response(TermSerializer(term).data, status=status.HTTP_201_CREATED)


class TermViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TermSerializer

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return TermCreateUpdateSerializer
        return TermSerializer

    def get_queryset(self):
        qs = Term.objects.filter(
            academic_year__school_id__in=accessible_school_ids(self.request)
        ).select_related("academic_year")
        year_id = self.request.query_params.get("academic_year")
        if year_id:
            qs = qs.filter(academic_year_id=year_id)
        return qs.order_by("order")


class SectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SectionSerializer

    def get_queryset(self):
        qs = Section.objects.filter(
            grade_level__school_id__in=accessible_school_ids(self.request)
        ).select_related("grade_level")
        grade_id = self.request.query_params.get("grade_level")
        if grade_id:
            qs = qs.filter(grade_level_id=grade_id)
        return qs

    def perform_create(self, serializer):
        grade = serializer.validated_data["grade_level"]
        if grade.school_id not in set(accessible_school_ids(self.request)):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Invalid grade level for this school.")
        serializer.save()


class StreamViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StreamSerializer

    def get_queryset(self):
        qs = Stream.objects.filter(
            grade_level__school_id__in=accessible_school_ids(self.request)
        ).select_related("grade_level")
        grade_id = self.request.query_params.get("grade_level")
        if grade_id:
            qs = qs.filter(grade_level_id=grade_id)
        return qs


class SubjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SubjectCreateUpdateSerializer
        return SubjectSerializer

    def get_queryset(self):
        return Subject.objects.filter(
            school_id__in=accessible_school_ids(self.request)
        ).select_related("department")

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))



from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import GradeRequirement, GradeLevel
from .serializers import GradeRequirementSerializer


class GradeRequirementViewSet(viewsets.ModelViewSet):
    """CRUD for per-grade admission requirements (offer letter page 1)."""
    serializer_class = GradeRequirementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = GradeRequirement.objects.select_related("grade_level", "school")
        school_id = self.request.headers.get("X-School-ID") or self.request.query_params.get("school")
        if school_id:
            qs = qs.filter(school_id=school_id)
        grade = self.request.query_params.get("grade_level")
        if grade:
            qs = qs.filter(grade_level_id=grade)
        active = self.request.query_params.get("is_active")
        if active in ("1", "true", "True"):
            qs = qs.filter(is_active=True)
        return qs.order_by("grade_level__order", "sort_order", "id")

    def perform_create(self, serializer):
        school_id = self.request.headers.get("X-School-ID") or self.request.data.get("school")
        serializer.save(school_id=school_id)

    @action(detail=False, methods=["post"], url_path="seed-cbc-defaults")
    def seed_cbc_defaults(self, request):
        """Create default CBC requirement lists for all school grades (skip existing)."""
        school_id = request.headers.get("X-School-ID") or request.data.get("school")
        if not school_id:
            return Response({"detail": "X-School-ID required"}, status=status.HTTP_400_BAD_REQUEST)

        defaults = _cbc_default_requirements()
        grades = GradeLevel.objects.filter(school_id=school_id).order_by("order")
        created = 0
        for grade in grades:
            key = _match_grade_key(grade.name)
            items = defaults.get(key) or defaults.get("PRIMARY_GENERAL") or []
            if GradeRequirement.objects.filter(school_id=school_id, grade_level=grade).exists():
                continue
            for i, text in enumerate(items):
                GradeRequirement.objects.create(
                    school_id=school_id,
                    grade_level=grade,
                    item_text=text,
                    sort_order=i,
                    is_active=True,
                )
                created += 1
        return Response({"created": created, "grades": grades.count()})


def _match_grade_key(name: str) -> str:
    n = (name or "").strip().lower().replace("-", " ")
    if "play" in n or n in ("pg", "baby"):
        return "PLAYGROUP"
    if "pp1" in n or "pre primary 1" in n or "preprimary 1" in n:
        return "PP1"
    if "pp2" in n or "pre primary 2" in n or "preprimary 2" in n:
        return "PP2"
    for g in range(1, 10):
        if f"grade {g}" in n or n == f"g{g}" or n == str(g):
            return f"GRADE_{g}"
    if "junior" in n:
        return "GRADE_7"
    return "PRIMARY_GENERAL"


def _cbc_default_requirements():
    """Sensible CBC Kenya starter lists — schools edit in Settings."""
    common_pre = [
        "Birth certificate (copy)",
        "2 passport-size photos",
        "School uniform (as per school colours)",
        "Sports wear / PE kit",
        "School bag",
        "Water bottle (labelled)",
        "Handkerchief / tissue pack",
    ]
    books_lower = [
        "Exercise books (as guided by class teacher)",
        "Drawing book",
        "Pencils, eraser, sharpener",
        "Crayons / coloured pencils",
        "Glue stick",
    ]
    books_mid = [
        "Mathematical set",
        "Ruler 30cm",
        "Blue and red pens",
        "Pencils, eraser, sharpener",
        "Exercise books (as guided by class teacher)",
        "English / Kiswahili dictionary (recommended)",
    ]
    books_junior = [
        "Mathematical set & graph book",
        "Scientific calculator (as advised)",
        "Blue, black and red pens",
        "Exercise books (as guided)",
        "Ream of ruled paper (optional contribution)",
    ]
    return {
        "PLAYGROUP": common_pre + [
            "Extra set of clothes",
            "Feeding bottle / snack container (if applicable)",
            "Rest mat / towel (if required by school)",
        ] + books_lower[:4],
        "PP1": common_pre + books_lower + ["Story book (age-appropriate)"],
        "PP2": common_pre + books_lower + ["Story book (age-appropriate)", "Number chart (home use)"],
        "GRADE_1": common_pre + books_lower + ["Homework diary", "Reading book"],
        "GRADE_2": common_pre + books_lower + ["Homework diary", "Reading book"],
        "GRADE_3": common_pre + books_mid + ["Homework diary"],
        "GRADE_4": common_pre + books_mid + ["Homework diary", "Atlas (recommended)"],
        "GRADE_5": common_pre + books_mid + ["Homework diary", "Atlas (recommended)"],
        "GRADE_6": common_pre + books_mid + ["Homework diary", "Atlas (recommended)"],
        "GRADE_7": common_pre + books_junior + ["Homework diary"],
        "GRADE_8": common_pre + books_junior + ["Homework diary"],
        "GRADE_9": common_pre + books_junior + ["Homework diary"],
        "PRIMARY_GENERAL": common_pre + books_mid,
    }
