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
    GradeLevelSerializer, GradeLevelCreateUpdateSerializer,
    DepartmentSerializer, DepartmentCreateUpdateSerializer,
)
from apps.school.models import School

class CurriculumTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public endpoint for setup wizard to list available curriculum templates
    """
    queryset = Curriculum.objects.filter(is_template=True, is_active=True)
    serializer_class = CurriculumTemplateSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class CurriculumViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CurriculumCreateUpdateSerializer
        return CurriculumSerializer

    def get_queryset(self):
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            return Curriculum.objects.filter(school_id=school_id)
        if self.request.user.is_staff:
            return Curriculum.objects.all()
        return Curriculum.objects.none()

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            serializer.save()
        else:
            school = get_object_or_404(School, id=school_id)
            if not school.users.filter(id=self.request.user.id).exists():
                raise PermissionDenied("You do not have access to this school")
            serializer.save(school=school)

class CopyCurriculumTemplateAPIView(APIView):
    """
    Clones a curriculum template and its associated grade levels 
    making them owned by the specific school.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        school_id = request.headers.get('X-School-ID')
        if not school_id:
            return Response({"error": "X-School-ID header required"}, status=400)

        school = get_object_or_404(School, id=school_id)
        if not school.users.filter(id=request.user.id).exists():
            raise PermissionDenied("No access to this school")

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
                    'pathway': gl.pathway,
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

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return GradeLevelCreateUpdateSerializer
        return GradeLevelSerializer

    def get_queryset(self):
        queryset = GradeLevel.objects.all()

        school_id = self.request.headers.get('X-School-ID')
        curriculum_id = self.request.query_params.get('curriculum')
        is_template_only = self.request.query_params.get('school__isnull') == 'true'

        if school_id:
            queryset = queryset.filter(school_id=school_id)

        if curriculum_id:
            queryset = queryset.filter(curriculum_id=curriculum_id)

        if is_template_only:
            queryset = queryset.filter(school__isnull=True)

        return queryset.order_by('order', 'name')

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            raise PermissionDenied("X-School-ID header required")
        school = get_object_or_404(School, id=school_id)
        serializer.save(school=school)

    @action(detail=False, methods=['delete'], url_path='bulk-delete')
    @transaction.atomic
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        school_id = request.headers.get('X-School-ID')
        if not school_id or not ids:
            return Response({"detail": "Missing IDs or X-School-ID"}, status=400)

        deleted = GradeLevel.objects.filter(id__in=ids, school_id=school_id).delete()
        return Response({"detail": f"Deleted {deleted[0]} grade levels"}, status=204)


class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DepartmentCreateUpdateSerializer
        return DepartmentSerializer

    def get_queryset(self):
        queryset = Department.objects.all()

        # 1. School from header (priority for authenticated school-specific views)
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
            return queryset.order_by('name')

        # 2. Respect ?school__isnull=true (for wizard template/global fetch)
        if self.request.query_params.get('school__isnull') == 'true':
            queryset = queryset.filter(school__isnull=True)

        # Optional: other filters like curriculum if needed later
        return queryset.order_by('name')

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            raise PermissionDenied("X-School-ID header required")
        school = get_object_or_404(School, id=school_id)
        serializer.save(school=school)

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