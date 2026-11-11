import os
import tempfile
from unittest.mock import Mock, patch

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from requests import HTTPError

from apps.core.storage import CloudinaryStorage
from apps.core.storage import LessonStorage, SubmissionStorage


class CloudinaryPrivateDownloadTests(SimpleTestCase):
    @patch.dict(os.environ, {"CLOUDINARY_URL": "cloudinary://test:test@example"})
    @patch("apps.core.storage.CloudinaryStorage._sdk")
    def test_private_pdf_upload_and_read_calls_signed_expiring_download(self, sdk_mock):
        uploader = Mock()
        uploader.upload.return_value = {
            "public_id": "school-erp/schools/school-id/students/medical-documents/report.pdf",
            "resource_type": "raw",
            "type": "authenticated",
        }
        private_download_url = Mock(return_value="https://cloudinary.invalid/signed.pdf")
        sdk_mock.return_value = (Mock(), uploader, Mock(), private_download_url)
        response = Mock(content=b"%PDF-1.7\n123%%EOF")
        response.raise_for_status.return_value = None
        storage = CloudinaryStorage({
            "folder": "school-erp/schools/school-id/students/medical-documents",
            "private": True,
            "school_scoped": False,
        })
        pdf = SimpleUploadedFile("report.pdf", b"%PDF-1.7\n123%%EOF")

        with patch("requests.get", return_value=response) as get_mock, patch(
            "time.time", return_value=1_700_000_000
        ):
            stored_name = storage._save("medical_documents/report.pdf", pdf)
            self.assertEqual(
                stored_name,
                "cloudinary:raw:authenticated:school-erp/schools/school-id/students/medical-documents/report.pdf#pdf",
            )
            retrieved = storage._open(stored_name)

        self.assertEqual(retrieved.read(), b"%PDF-1.7\n123%%EOF")
        uploader.upload.assert_called_once()
        self.assertEqual(uploader.upload.call_args.kwargs["resource_type"], "raw")
        self.assertEqual(uploader.upload.call_args.kwargs["type"], "authenticated")
        private_download_url.assert_called_once_with(
            "school-erp/schools/school-id/students/medical-documents/report.pdf",
            "pdf",
            resource_type="raw",
            type="authenticated",
            expires_at=1_700_000_300,
            attachment=True,
        )
        get_mock.assert_called_once_with("https://cloudinary.invalid/signed.pdf", timeout=30)
        response.raise_for_status.assert_called_once_with()

    @patch.dict(os.environ, {"CLOUDINARY_URL": "cloudinary://test:test@example"})
    @patch("apps.core.storage.CloudinaryStorage._sdk")
    def test_school_owner_controls_folder_and_unrestricted_lesson_type(self, sdk_mock):
        uploader = Mock()
        uploader.upload.return_value = {
            "public_id": "school-erp/schools/school-a/students/photos/portrait",
            "resource_type": "image",
            "type": "upload",
        }
        sdk_mock.return_value = (Mock(), uploader, Mock(), Mock())
        owner = Mock(school_id="school-a")
        storage = CloudinaryStorage()
        image = SimpleUploadedFile("portrait.png", b"not-real-image")
        from apps.core.upload_context import upload_owner
        with upload_owner(owner):
            with patch("apps.core.file_validation.validate_image"):
                storage._save("student_photos/portrait.png", image)
        self.assertEqual(
            uploader.upload.call_args.kwargs["folder"],
            "school-erp/schools/school-a/students/photos",
        )

    @patch.dict(os.environ, {"CLOUDINARY_URL": "cloudinary://test:test@example"})
    @patch("apps.core.storage.CloudinaryStorage._sdk")
    def test_public_admission_photo_is_school_scoped(self, sdk_mock):
        uploader = Mock()
        uploader.upload.return_value = {
            "public_id": "school-erp/schools/school-a/admissions/photos/photo",
            "resource_type": "image", "type": "upload",
        }
        sdk_mock.return_value = (Mock(), uploader, Mock(), Mock())
        from apps.core.upload_context import upload_owner
        school = type("School", (), {"pk": "school-a"})()
        photo = SimpleUploadedFile("photo.jpg", b"image")
        with upload_owner(school), patch("apps.core.file_validation.validate_image"):
            CloudinaryStorage()._save("admission_photos/photo.jpg", photo)
        self.assertEqual(uploader.upload.call_args.kwargs["folder"],
                         "school-erp/schools/school-a/admissions/photos")

    @patch.dict(os.environ, {"CLOUDINARY_URL": "cloudinary://test:test@example"})
    @patch("apps.core.storage.CloudinaryStorage._sdk")
    def test_school_scoped_category_paths_keep_full_category(self, sdk_mock):
        from apps.core.upload_context import upload_owner

        cases = (
            ("medical_documents/report.pdf", "students/medical-documents",
             CloudinaryStorage(), "raw", "authenticated"),
            ("admission_documents/report.pdf", "admissions/documents",
             CloudinaryStorage(), "raw", "authenticated"),
            ("lessons/slides.pptx", "elearning/lessons",
             LessonStorage(), "raw", "upload"),
            ("submissions/work.pdf", "elearning/submissions",
             SubmissionStorage(), "raw", "authenticated"),
        )
        for index, (name, category, storage, resource_type, delivery_type) in enumerate(cases):
            with self.subTest(name=name):
                uploader = Mock()
                uploader.upload.return_value = {
                    "public_id": f"school-erp/schools/school-a/{category}/file",
                    "resource_type": resource_type,
                    "type": delivery_type,
                }
                sdk_mock.return_value = (Mock(), uploader, Mock(), Mock())
                owner = Mock(school_id="school-a")
                content = SimpleUploadedFile(name.rsplit("/", 1)[-1], b"file")
                with upload_owner(owner), \
                     patch("apps.core.file_validation.validate_upload"), \
                     patch("apps.core.file_validation.validate_image"):
                    storage._save(name, content)
                self.assertEqual(
                    uploader.upload.call_args.kwargs["folder"],
                    f"school-erp/schools/school-a/{category}",
                )
                self.assertEqual(uploader.upload.call_args.kwargs["resource_type"], resource_type)
                self.assertEqual(uploader.upload.call_args.kwargs["type"], delivery_type)

    @patch.dict(os.environ, {"CLOUDINARY_URL": "cloudinary://test:test@example"})
    @patch("apps.core.storage.CloudinaryStorage._sdk")
    def test_legacy_cloudinary_reference_without_format_suffix_remains_readable(self, sdk_mock):
        downloader = Mock(return_value="https://cloudinary.invalid/legacy.pdf")
        sdk_mock.return_value = (Mock(), Mock(), Mock(), downloader)
        response = Mock(content=b"legacy")
        response.raise_for_status.return_value = None
        legacy = "cloudinary:raw:authenticated:school/path/legacy.pdf"
        with patch("requests.get", return_value=response), patch("time.time", return_value=1000):
            result = CloudinaryStorage()._open(legacy)
        self.assertEqual(result.read(), b"legacy")
        downloader.assert_called_once_with(
            "school/path/legacy.pdf", "pdf", resource_type="raw",
            type="authenticated", expires_at=1300, attachment=True,
        )

    def test_local_file_fallback_still_opens(self):
        with tempfile.TemporaryDirectory() as media_root:
            storage = CloudinaryStorage(location=media_root, base_url="/media/")
            with patch.dict(os.environ, {"CLOUDINARY_URL": ""}):
                stored_name = storage.save("medical_documents/legacy.pdf", ContentFile(b"local pdf"))
                self.assertEqual(storage.open(stored_name).read(), b"local pdf")

    @patch.dict(os.environ, {"CLOUDINARY_URL": "cloudinary://test:test@example"})
    @patch("apps.core.storage.CloudinaryStorage._sdk")
    def test_cloudinary_http_failure_propagates(self, sdk_mock):
        private_download_url = Mock(return_value="https://cloudinary.invalid/signed.pdf")
        sdk_mock.return_value = (Mock(), Mock(), Mock(), private_download_url)
        response = Mock()
        response.raise_for_status.side_effect = HTTPError("download failed")
        reference = "cloudinary:raw:authenticated:school/path/document.pdf"

        with patch("requests.get", return_value=response):
            with self.assertRaises(HTTPError):
                CloudinaryStorage()._open(reference)
