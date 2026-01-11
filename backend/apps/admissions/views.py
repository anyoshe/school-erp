# admissions/views.py
from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from .models import Application
from .serializers import ApplicationSerializer, ApplicationCreateUpdateSerializer
from apps.students.serializers import StudentCreateUpdateSerializer  # Import for creating Student
from apps.students.models import Student

class ApplicationViewSet(ModelViewSet):
    queryset = Application.objects.prefetch_related('documents', 'fee_payments').all().order_by('-submitted_at')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ApplicationCreateUpdateSerializer
        return ApplicationSerializer

    @action(detail=True, methods=['post'])
    def onboard_to_student(self, request, pk=None):
        """
        Custom action: When application is ACCEPTED and fees paid, create pre-filled Student
        """
        application = self.get_object()
        
        if application.status != Application.Status.ACCEPTED:
            return Response({"detail": "Application must be ACCEPTED to onboard."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not application.fee_payments.exists():
            return Response({"detail": "Admission fee must be paid before onboarding."}, status=status.HTTP_400_BAD_REQUEST)
        
        if application.student:
            return Response({"detail": "Student already onboarded.", "student_id": application.student.id}, status=status.HTTP_400_BAD_REQUEST)
        
        # Pre-fill Student data
        student_data = {
            'admission_number': application.admission_number,
            'first_name': application.first_name,
            'last_name': application.last_name,
            'gender': application.gender,
            'date_of_birth': application.date_of_birth,
            'current_class': application.class_applied,
            'admission_date': application.admission_date,
            'nationality': application.nationality,
            'religion': application.religion,
            'category': application.category,
            # Add more mappings as needed (e.g., address fields)
        }
        
        student_serializer = StudentCreateUpdateSerializer(data=student_data)
        if student_serializer.is_valid():
            student = student_serializer.save()
            application.student = student
            application.status = Application.Status.ENROLLED
            application.save()
            return Response({
                "detail": "Student onboarded successfully.",
                "student_id": student.id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(student_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    
class PublicApplicationViewSet(ModelViewSet):
    queryset = Application.objects.all()
    serializer_class = ApplicationCreateUpdateSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        serializer.save(
            school=self.get_school_from_request(),
            status=Application.Status.SUBMITTED
        )
