from unittest.mock import Mock, patch

from django.test import SimpleTestCase
from rest_framework.permissions import IsAuthenticated

from apps.admissions.views import ApplicationDocumentViewSet
from apps.students.urls import _medical_document_for_school, download_medical_document


class PrivateDownloadAuthorizationTests(SimpleTestCase):
    def test_medical_download_endpoint_requires_authentication(self):
        self.assertIn(IsAuthenticated, download_medical_document.cls.permission_classes)

    @patch("apps.students.urls.accessible_school_ids", return_value=["school-a"])
    @patch("apps.students.urls.MedicalDocument.objects.filter")
    def test_medical_download_filters_by_accessible_school(self, filter_mock, _):
        filter_mock.return_value.first.return_value = "document"
        request = Mock()
        self.assertEqual(_medical_document_for_school(request, 42), "document")
        filter_mock.assert_called_once_with(
            pk=42, medical_record__school_id__in=["school-a"]
        )

    @patch("apps.admissions.views.accessible_school_ids", return_value=["school-b"])
    def test_admission_queryset_remains_school_scoped(self, _):
        view = ApplicationDocumentViewSet()
        view.request = Mock()
        original = Mock()
        view.queryset = original
        view.get_queryset()
        original.filter.assert_called_once_with(
            application__school_id__in=["school-b"]
        )
        self.assertIn(IsAuthenticated, ApplicationDocumentViewSet.permission_classes)
