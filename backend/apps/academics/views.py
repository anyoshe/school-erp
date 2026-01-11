# apps/academics/views.py
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
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

class CurriculumViewSet(ModelViewSet):
    """
    Manage academic curricula (CBC, 8-4-4, IGCSE, etc.)
    """
    queryset = Curriculum.objects.all().order_by('name')
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CurriculumCreateUpdateSerializer
        return CurriculumSerializer

    def get_queryset(self):
        # Important: filter to current user's school(s)
        user = self.request.user
        return self.queryset.filter(school__users=user)


class GradeLevelViewSet(ModelViewSet):
    """
    Manage grade levels / classes / forms (PP1, Grade 4, Form 2...)
    """
    queryset = GradeLevel.objects.all().order_by('order', 'name')
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return GradeLevelCreateUpdateSerializer
        return GradeLevelSerializer

    def get_queryset(self):
        user = self.request.user
        return self.queryset.filter(school__users=user)


class DepartmentViewSet(ModelViewSet):
    """
    Manage departments / streams (Science, Humanities, Technical...)
    """
    queryset = Department.objects.all().order_by('name')
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DepartmentCreateUpdateSerializer
        return DepartmentSerializer

    def get_queryset(self):
        user = self.request.user
        return self.queryset.filter(school__users=user)