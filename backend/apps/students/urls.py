from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound
from django.http import FileResponse
from .models import MedicalDocument
from apps.school.support import accessible_school_ids


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_medical_document(request, document_id):
    document = _medical_document_for_school(request, document_id)
    if not document:
        raise NotFound()
    try:
        return FileResponse(document.file.open('rb'), as_attachment=True,
                            filename=document.file.name.rsplit(':', 1)[-1].rsplit('/', 1)[-1])
    except Exception as exc:
        if document.file.name.startswith("cloudinary:"):
            raise NotFound("Cloudinary document retrieval failed.") from exc
        raise NotFound("Document file is unavailable.")


def _medical_document_for_school(request, document_id):
    return MedicalDocument.objects.filter(
        pk=document_id,
        medical_record__school_id__in=accessible_school_ids(request),
    ).first()
from .views import (
    StudentViewSet,
    GuardianViewSet,
    StudentGuardianViewSet,
    MedicalRecordViewSet,
)

router = DefaultRouter()
router.register(r'guardians', GuardianViewSet, basename='guardian')
router.register(r'', StudentViewSet, basename='student')  # /api/students/

urlpatterns = [
    path('student-guardians/', StudentGuardianViewSet.as_view({'get': 'list'}), name='student-guardian-list'),
    path('medical-records/', MedicalRecordViewSet.as_view({
        'get': 'list', 'post': 'create'
    }), name='medical-record-list'),
    path('medical-records/<uuid:pk>/', MedicalRecordViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'patch': 'partial_update',
        'delete': 'destroy'
    }), name='medical-record-detail'),
    path('medical-documents/<int:document_id>/download/',
         download_medical_document,
         name='medical-document-download'),
    path('', include(router.urls)),
]
