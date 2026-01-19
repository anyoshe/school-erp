
# apps/academics/views.py
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied, ValidationError
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
            serializer.save()  # Allow wizard temporary creation (rare)
        else:
            school = get_object_or_404(School, id=school_id)
            if not school.users.filter(id=self.request.user.id).exists():
                raise PermissionDenied("You do not have access to this school")
            serializer.save(school=school)


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

        # 1. School-specific filter (normal authenticated use)
        if school_id:
            queryset = queryset.filter(school_id=school_id)

        # 2. Filter by specific curriculum (used in wizard after template selection)
        if curriculum_id:
            queryset = queryset.filter(curriculum_id=curriculum_id)

        # 3. Template-only mode (wizard before school exists)
        if is_template_only:
            queryset = queryset.filter(school__isnull=True)

        return queryset.order_by('order', 'name')

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            raise PermissionDenied("X-School-ID header required for creating grade levels")
        school = get_object_or_404(School, id=school_id)
        if not school.users.filter(id=self.request.user.id).exists():
            raise PermissionDenied("No access to this school")
        serializer.save(school=school)


class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DepartmentCreateUpdateSerializer
        return DepartmentSerializer

    def get_queryset(self):
        queryset = Department.objects.all()

        school_id = self.request.headers.get('X-School-ID')
        is_template_only = self.request.query_params.get('school__isnull') == 'true'

        if school_id:
            queryset = queryset.filter(school_id=school_id)

        if is_template_only:
            queryset = queryset.filter(school__isnull=True)

        return queryset.order_by('name')

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            raise PermissionDenied("X-School-ID header required for creating departments")
        school = get_object_or_404(School, id=school_id)
        if not school.users.filter(id=self.request.user.id).exists():
            raise PermissionDenied("No access to this school")
        serializer.save(school=school)


class CopyCurriculumTemplateAPIView(APIView):
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
        # Optional: selective copy (for future enhancement)
        grade_level_ids = request.data.get('grade_level_ids', [])
        department_ids = request.data.get('department_ids', [])

        template = get_object_or_404(Curriculum, pk=template_id, is_template=True)

        new_curriculum, created = Curriculum.objects.get_or_create(
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

        if not created:
            return Response({"warning": "Curriculum already exists, using existing one"})

        # Copy grades (all or selected)
        grade_qs = GradeLevel.objects.filter(curriculum=template)
        if grade_level_ids:
            grade_qs = grade_qs.filter(pk__in=grade_level_ids)

        for gl in grade_qs:
            GradeLevel.objects.get_or_create(
                school=school,
                curriculum=new_curriculum,
                name=gl.name,
                defaults={
                    'short_name': gl.short_name,
                    'order': gl.order,
                    'code': gl.code
                }
            )

        # Copy departments (all or selected)
        dept_qs = Department.objects.filter(school__isnull=True)
        if department_ids:
            dept_qs = dept_qs.filter(pk__in=department_ids)

        for dep in dept_qs:
            Department.objects.get_or_create(
                school=school,
                name=dep.name,
                defaults={
                    'short_name': dep.short_name,
                    'code': dep.code,
                    'curriculum': new_curriculum
                }
            )

        return Response({
            "success": True,
            "new_curriculum_id": new_curriculum.id,
            "message": f"Successfully copied {template.name} to {school.name}"
        }, status=201)