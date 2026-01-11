from rest_framework.viewsets import ModelViewSet
from rest_framework import viewsets  # <-- Add this import
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Student, Guardian, StudentGuardian, MedicalRecord
from .serializers import (
    StudentSerializer,
    StudentCreateUpdateSerializer,
    GuardianSerializer,
    StudentGuardianSerializer,
    LinkExistingGuardianSerializer,  # <-- Make sure this is imported
    MedicalRecordSerializer,
    MedicalRecordCreateUpdateSerializer
)

# ----------------------------
# STUDENT VIEWSET
# ----------------------------

class StudentViewSet(ModelViewSet):
    queryset = Student.objects.all().order_by('admission_number')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentCreateUpdateSerializer
        return StudentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("Validation errors:", serializer.errors)  # <-- Add this
        serializer.is_valid(raise_exception=True)
        return super().create(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            self.get_object(),
            data=request.data,
            partial=True
        )
        if not serializer.is_valid():
            print("PATCH ERRORS:", serializer.errors)
        serializer.is_valid(raise_exception=True)
        return super().partial_update(request, *args, **kwargs)


# ----------------------------
# GUARDIAN VIEWSET
# ----------------------------
class GuardianViewSet(ModelViewSet):
    queryset = Guardian.objects.all().order_by('full_name')
    permission_classes = [IsAuthenticated]
    serializer_class = GuardianSerializer


# ----------------------------
# STUDENT-GUARDIAN VIEWSET
# ----------------------------
class StudentGuardianViewSet(viewsets.ModelViewSet):  # <-- Use viewsets.ModelViewSet
    queryset = StudentGuardian.objects.select_related('student', 'guardian').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student']

    def get_serializer_class(self):
        # Use different serializer for linking existing guardians
        if self.action == 'link_existing':
            return LinkExistingGuardianSerializer
        return StudentGuardianSerializer
    
    @action(detail=False, methods=['post'])
    def link_existing(self, request):
        """Link an existing guardian to a student"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


# ----------------------------
# MEDICAL RECORD VIEWSET
# ----------------------------
class MedicalRecordViewSet(ModelViewSet):
    queryset = MedicalRecord.objects.select_related("student").prefetch_related("documents").all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["student"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return MedicalRecordCreateUpdateSerializer
        return MedicalRecordSerializer

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(reviewed_by=self.request.user)

    def create(self, request, *args, **kwargs):
        print("CREATE DATA:", request.data)
        print("FILES:", request.FILES)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        print("UPDATE DATA:", request.data)
        print("FILES:", request.FILES)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        print("PATCH DATA:", request.data)
        print("FILES:", request.FILES)
        return super().partial_update(request, *args, **kwargs)
        
    