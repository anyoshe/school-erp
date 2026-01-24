# admissions/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ApplicationViewSet,
    ApplicationDocumentViewSet,
    AdmissionFeePaymentViewSet,
    PublicApplicationSubmissionViewSet,
)

router = DefaultRouter()
router.register(r'applications', ApplicationViewSet, basename='application')
router.register(r'application-documents', ApplicationDocumentViewSet, basename='application-document')
router.register(r'admission-fee-payments', AdmissionFeePaymentViewSet, basename='admission-fee-payment')

# Public endpoints (manual paths - no duplicate router.register)
public_urls = [
    # Create new application (POST)
    path('applications/submit/', PublicApplicationSubmissionViewSet.as_view({
        'post': 'create',
    }), name='public-application-submit'),

    # NEW: Fetch existing draft (GET)
    path('applications/<uuid:pk>/', PublicApplicationSubmissionViewSet.as_view({
        'get': 'retrieve',
    }), name='public-application-detail'),

    # Update existing draft (PATCH) - using custom action
    path('applications/<uuid:pk>/update/', PublicApplicationSubmissionViewSet.as_view({
        'patch': 'update_draft',
    }), name='public-application-update'),
]

urlpatterns = [
    path('', include(router.urls)),
    path('public/', include(public_urls)),
]