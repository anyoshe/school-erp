# admissions/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ApplicationViewSet,
    ApplicationDocumentViewSet,
    AdmissionFeePaymentViewSet,
    PublicApplicationSubmissionViewSet,
)

# Main router for authenticated school staff/admin endpoints
router = DefaultRouter()
router.register(r'applications', ApplicationViewSet, basename='application')
router.register(r'application-documents', ApplicationDocumentViewSet, basename='application-document')
router.register(r'admission-fee-payments', AdmissionFeePaymentViewSet, basename='admission-fee-payment')

# Public submission endpoint (no authentication required)
# You can later secure this with CAPTCHA, rate limiting, or a school-specific token
public_urls = [
    path('applications/submit/', PublicApplicationSubmissionViewSet.as_view({
        'post': 'create'
    }), name='public-application-submit'),
]

urlpatterns = [
    # All authenticated staff endpoints
    path('', include(router.urls)),
    
    # Public-facing application submission (optional - comment out if not needed)
    path('public/', include(public_urls)),
]