# # apps/academics/views.py
# from rest_framework.viewsets import ModelViewSet
# from rest_framework.permissions import IsAuthenticated
# from .models import Curriculum, GradeLevel, Department
# from .serializers import (
#     CurriculumSerializer,
#     CurriculumCreateUpdateSerializer,
#     GradeLevelSerializer,
#     GradeLevelCreateUpdateSerializer,
#     DepartmentSerializer,
#     DepartmentCreateUpdateSerializer,
# )
# from apps.core.permissions import IsAssociatedWithSchool

# class CurriculumViewSet(ModelViewSet):
#     """
#     Manage academic curricula (CBC, 8-4-4, IGCSE, etc.)
#     """
#     queryset = Curriculum.objects.all().order_by('name')
#     permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

#     def get_serializer_class(self):
#         if self.action in ['create', 'update', 'partial_update']:
#             return CurriculumCreateUpdateSerializer
#         return CurriculumSerializer

#     def get_queryset(self):
#         # Important: filter to current user's school(s)
#         user = self.request.user
#         return self.queryset.filter(school__users=user)


# class GradeLevelViewSet(ModelViewSet):
#     """
#     Manage grade levels / classes / forms (PP1, Grade 4, Form 2...)
#     """
#     queryset = GradeLevel.objects.all().order_by('order', 'name')
#     permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

#     def get_serializer_class(self):
#         if self.action in ['create', 'update', 'partial_update']:
#             return GradeLevelCreateUpdateSerializer
#         return GradeLevelSerializer

#     def get_queryset(self):
#         user = self.request.user
#         return self.queryset.filter(school__users=user)


# class DepartmentViewSet(ModelViewSet):
#     """
#     Manage departments / streams (Science, Humanities, Technical...)
#     """
#     queryset = Department.objects.all().order_by('name')
#     permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

#     def get_serializer_class(self):
#         if self.action in ['create', 'update', 'partial_update']:
#             return DepartmentCreateUpdateSerializer
#         return DepartmentSerializer

#     def get_queryset(self):
#         user = self.request.user
#         return self.queryset.filter(school__users=user)

# apps/academics/views.py
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from .models import Curriculum, GradeLevel, Department
from .serializers import (
    CurriculumSerializer,
    CurriculumCreateUpdateSerializer,
    GradeLevelSerializer,
    GradeLevelCreateUpdateSerializer,
    DepartmentSerializer,
    DepartmentCreateUpdateSerializer,
)
from apps.core.permissions import IsAssociatedWithSchool
from apps.school.models import School


class CurriculumViewSet(ModelViewSet):
    """
    Manage academic curricula (CBC, 8-4-4, IGCSE, etc.)
    """
    queryset = Curriculum.objects.all().order_by('name')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CurriculumCreateUpdateSerializer
        return CurriculumSerializer

    def get_queryset(self):
        """
        During creation/setup → allow empty queryset (wizard needs to create)
        During normal use → filter by X-School-ID header (most secure)
        """
        school_id = self.request.headers.get('X-School-ID')

        if school_id:
            # Normal authenticated request with header → strict filter
            return self.queryset.filter(school_id=school_id)
        else:
            # Setup wizard / no header → return empty (safe) or allow creation
            # We let perform_create handle school assignment
            return self.queryset.none()

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            raise PermissionDenied("X-School-ID header is required to create curricula")
        
        # Extra safety: check user has access to this school
        if not School.objects.filter(id=school_id, users=self.request.user).exists():
            raise PermissionDenied("You do not have access to this school")

        serializer.save(school_id=school_id)


class GradeLevelViewSet(ModelViewSet):
    queryset = GradeLevel.objects.all().order_by('order', 'name')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return GradeLevelCreateUpdateSerializer
        return GradeLevelSerializer

    def get_queryset(self):
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            return self.queryset.filter(school_id=school_id)
        return self.queryset.none()

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            raise PermissionDenied("X-School-ID header is required")
        
        if not School.objects.filter(id=school_id, users=self.request.user).exists():
            raise PermissionDenied("No access to this school")

        serializer.save(school_id=school_id)


class DepartmentViewSet(ModelViewSet):
    queryset = Department.objects.all().order_by('name')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DepartmentCreateUpdateSerializer
        return DepartmentSerializer

    def get_queryset(self):
        school_id = self.request.headers.get('X-School-ID')
        if school_id:
            return self.queryset.filter(school_id=school_id)
        return self.queryset.none()

    def perform_create(self, serializer):
        school_id = self.request.headers.get('X-School-ID')
        if not school_id:
            raise PermissionDenied("X-School-ID header is required")
        
        if not School.objects.filter(id=school_id, users=self.request.user).exists():
            raise PermissionDenied("No access to this school")

        serializer.save(school_id=school_id)