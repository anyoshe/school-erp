from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import Student, Guardian, StudentGuardian, MedicalRecord
from .serializers import (
    StudentSerializer, StudentCreateUpdateSerializer,
    GuardianSerializer,
    StudentGuardianSerializer, LinkExistingGuardianSerializer,
    MedicalRecordSerializer, MedicalRecordCreateUpdateSerializer
)

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'status', 'current_class', 'gender', 'nationality']

    def get_queryset(self):
        return self.queryset.filter(school=self.request.user.school)  # Tenancy filter (adjust if user has school)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentCreateUpdateSerializer
        return StudentSerializer

class GuardianViewSet(viewsets.ModelViewSet):
    queryset = Guardian.objects.all()
    serializer_class = GuardianSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school=self.request.user.school)

class StudentGuardianViewSet(viewsets.ModelViewSet):
    queryset = StudentGuardian.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'is_primary', 'is_active']

    def get_serializer_class(self):
        if self.action == 'link_existing':
            return LinkExistingGuardianSerializer
        return StudentGuardianSerializer

    def get_queryset(self):
        return self.queryset.filter(student__school=self.request.user.school)

    @action(detail=False, methods=['post'])
    def link_existing(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

class MedicalRecordViewSet(viewsets.ModelViewSet):
    queryset = MedicalRecord.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'immunization_status']

    def get_queryset(self):
        return self.queryset.filter(school=self.request.user.school)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MedicalRecordCreateUpdateSerializer
        return MedicalRecordSerializer

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school, recorded_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(reviewed_by=self.request.user)