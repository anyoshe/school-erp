from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from .models import Student, Guardian, StudentGuardian, MedicalRecord
from .serializers import (
    StudentSerializer, StudentCreateUpdateSerializer,
    GuardianSerializer,
    StudentGuardianSerializer, LinkExistingGuardianSerializer,
    MedicalRecordSerializer, MedicalRecordCreateUpdateSerializer
)


class StudentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for students - full CRUD + reports
    """
    queryset = Student.objects.select_related(
        'school', 'current_class', 'fee_structure'
    ).prefetch_related('guardians__guardian', 'medical_record__documents')
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        'school', 'status', 'current_class', 'gender', 'nationality',
        'boarding_status', 'fee_structure'
    ]
    search_fields = [
        'first_name', 'last_name', 'admission_number', 'learner_id',
        'full_name', 'national_student_id'
    ]
    ordering_fields = ['admission_number', 'admission_date', 'status', 'current_class']

    # def get_queryset(self):
    #     # Multi-tenancy: only show students from user's school
    #     return self.queryset.filter(school=self.request.user.school)
    def get_queryset(self):
        return self.queryset.filter(school__in=self.request.user.schools.all())

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentCreateUpdateSerializer
        return StudentSerializer

    @action(detail=False, methods=['get'], url_path='outstanding-fees')
    def outstanding_fees_report(self, request):
        """
        List students with outstanding fees (dynamic from finance)
        """
        students = self.get_queryset()
        data = []
        for student in students:
            balance = student.get_outstanding_balance()
            if balance > 0:
                data.append({
                    'id': str(student.id),
                    'full_name': student.full_name,
                    'admission_number': student.admission_number,
                    'balance': float(balance),
                    'fee_structure': str(student.fee_structure) if student.fee_structure else 'None'
                })
        return Response(data)

    @action(detail=True, methods=['get'], url_path='balance')
    def get_balance(self, request, pk=None):
        student = self.get_object()
        return Response({'outstanding_balance': float(student.get_outstanding_balance())})


class GuardianViewSet(viewsets.ModelViewSet):
    queryset = Guardian.objects.select_related('school')
    serializer_class = GuardianSerializer
    permission_classes = [IsAuthenticated]

    # def get_queryset(self):
    #     return self.queryset.filter(school=self.request.user.school)
    def get_queryset(self):
        return self.queryset.filter(school__in=self.request.user.schools.all())


class StudentGuardianViewSet(viewsets.ModelViewSet):
    queryset = StudentGuardian.objects.select_related('student', 'guardian')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'guardian', 'is_primary', 'is_active']

    def get_serializer_class(self):
        if self.action == 'link_existing':
            return LinkExistingGuardianSerializer
        return StudentGuardianSerializer

    def get_queryset(self):
        return self.queryset.filter(student__school=self.request.user.school)

    @action(detail=False, methods=['post'], url_path='link-existing')
    def link_existing(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(self.get_serializer(instance).data, status=201)


class MedicalRecordViewSet(viewsets.ModelViewSet):
    queryset = MedicalRecord.objects.select_related(
        'student', 'school', 'consent_by', 'recorded_by', 'reviewed_by'
    ).prefetch_related('documents')
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