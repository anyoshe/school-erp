"""Django storage backend for Cloudinary with legacy local-file support."""
import os
from pathlib import Path
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage


class CloudinaryStorage(FileSystemStorage):
    """Use Cloudinary for new files when configured; local files remain readable."""

    def __init__(self, options=None, **kwargs):
        self.options = options or {}
        super().__init__(**kwargs)

    @staticmethod
    def _sdk():
        try:
            import cloudinary
            from cloudinary import api, uploader
            from cloudinary.utils import cloudinary_url, private_download_url
        except ImportError as exc:
            raise ImproperlyConfigured("Install the Cloudinary SDK to enable CLOUDINARY_URL storage.") from exc
        cloudinary.config(secure=True)
        return api, uploader, cloudinary_url, private_download_url

    @property
    def configured(self):
        value = os.environ.get("CLOUDINARY_URL")
        if not value:
            return False
        parsed = urlsplit(value)
        if parsed.scheme != "cloudinary" or not parsed.hostname or not parsed.username or not parsed.password:
            raise ImproperlyConfigured("CLOUDINARY_URL is malformed; configure it in the backend environment.")
        self._sdk()
        return True

    def _save(self, name, content):
        if not self.configured:
            return super()._save(name, content)

        from apps.core.file_validation import validate_image, validate_upload

        category_name = Path(name).parent.name
        image_category = self.options.get("images", category_name in {
            "school_logos", "student_photos", "admission_photos"
        })
        restricted_documents = category_name in {"medical_documents", "admission_documents"}
        suffix = Path(name).suffix.lower()
        resource_type = "image" if image_category else "raw"
        content.name = Path(name).name
        if image_category:
            validate_image(content)
        elif restricted_documents:
            validate_upload(content)
        private = self.options.get("private", Path(name).parent.name in {
            "medical_documents", "admission_documents", "submissions"
        })
        if category_name in {"medical_documents", "admission_documents", "submissions"} and not private:
            raise ImproperlyConfigured("Sensitive student uploads require private Cloudinary delivery.")
        delivery_type = self.options.get("delivery_type", "authenticated" if private else "upload")
        category = self.options.get("folder") or {
            "school_logos": "logos",
            "student_photos": "students/photos",
            "medical_documents": "students/medical-documents",
            "admission_photos": "admissions/photos",
            "admission_documents": "admissions/documents",
            "lessons": "elearning/lessons",
            "submissions": "elearning/submissions",
        }.get(Path(name).parent.name, Path(name).parent.as_posix())
        school_scoped = self.options.get("school_scoped", True)
        school_id = self.options.get("school_id")
        if school_id is None and school_scoped:
            school_id = self._school_id_from_upload_name(name)
        if school_scoped:
            if not school_id and not self.options.get("allow_unscoped", False):
                raise ImproperlyConfigured("A school context is required to upload this file to Cloudinary.")
            tenant_area = category.strip("/")
            folder = f"school-erp/schools/{school_id}/{tenant_area}" if school_id else f"school-erp/{category}"
        else:
            folder = f"school-erp/{category.strip('/')}"

        _, uploader, _, _ = self._sdk()
        content.seek(0)
        try:
            result = uploader.upload(
                content,
                resource_type=resource_type,
                type=delivery_type,
                folder=folder,
                use_filename=True,
                unique_filename=True,
                overwrite=False,
                filename_override=Path(name).name,
            )
        except Exception:
            content.seek(0)
            raise
        else:
            content.seek(0)
        public_id = result.get("public_id")
        if not public_id:
            raise IOError("Cloudinary upload response did not contain a public ID.")
        return self._reference(
            result.get("type", delivery_type),
            result.get("resource_type", resource_type),
            public_id,
            Path(name).suffix.lstrip("."),
        )

    def _open(self, name, mode="rb"):
        if not name.startswith("cloudinary:"):
            return super()._open(name, mode)
        _, resource_type, delivery_type, public_id, file_format = self._parse_reference(name)
        _, _, cloudinary_url, private_download_url = self._sdk()
        if delivery_type in {"authenticated", "private"}:
            import time
            file_format = file_format or Path(public_id).suffix.lstrip(".")
            if not file_format:
                raise ValueError("Private Cloudinary asset reference has no file format.")
            url = private_download_url(
                public_id,
                file_format,
                resource_type=resource_type,
                type=delivery_type,
                expires_at=int(time.time()) + 300,
                attachment=True,
            )
        else:
            url = cloudinary_url(public_id, resource_type=resource_type, type=delivery_type, secure=True)[0]
        import requests
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        content = ContentFile(response.content)
        content.seek(0)
        return content

    def exists(self, name):
        if not name.startswith("cloudinary:"):
            return super().exists(name)
        api, _, _, _ = self._sdk()
        _, resource_type, delivery_type, public_id, _ = self._parse_reference(name)
        try:
            api.resource(public_id, resource_type=resource_type, type=delivery_type)
            return True
        except Exception as exc:
            if getattr(exc, "http_code", None) == 404:
                return False
            raise

    def delete(self, name):
        if not name.startswith("cloudinary:"):
            return super().delete(name)
        _, uploader, _, _ = self._sdk()
        _, resource_type, delivery_type, public_id, _ = self._parse_reference(name)
        result = uploader.destroy(public_id, resource_type=resource_type, type=delivery_type, invalidate=True)
        if result.get("result") not in {"ok", "not found"}:
            raise IOError(f"Cloudinary deletion failed: {result.get('result', 'unknown response')}")

    def url(self, name):
        if not name.startswith("cloudinary:"):
            return super().url(name)
        _, resource_type, delivery_type, public_id, _ = self._parse_reference(name)
        _, _, cloudinary_url, _ = self._sdk()
        if delivery_type in {"authenticated", "private"}:
            return cloudinary_url(
                public_id, resource_type=resource_type, type=delivery_type,
                sign_url=True, secure=True,
            )[0]
        return cloudinary_url(public_id, resource_type=resource_type, type=delivery_type, secure=True)[0]

    def size(self, name):
        if not name.startswith("cloudinary:"):
            return super().size(name)
        api, _, _, _ = self._sdk()
        _, resource_type, delivery_type, public_id, _ = self._parse_reference(name)
        return api.resource(public_id, resource_type=resource_type, type=delivery_type)["bytes"]

    @staticmethod
    def _reference(delivery_type, resource_type, public_id, file_format=""):
        reference = f"cloudinary:{resource_type}:{delivery_type}:{public_id}"
        return f"{reference}#{file_format}" if file_format else reference

    @staticmethod
    def _parse_reference(name):
        reference, separator, file_format = name.partition("#")
        prefix, resource_type, delivery_type, public_id = reference.split(":", 3)
        if prefix != "cloudinary" or resource_type not in {"image", "raw", "video"}:
            raise ValueError("Invalid Cloudinary storage reference.")
        return prefix, resource_type, delivery_type, public_id, file_format

    @staticmethod
    def _school_id_from_upload_name(name):
        from .upload_context import current_upload_owner
        owner = current_upload_owner()
        if owner is not None:
            # School.logo is owned directly by the School instance; other
            # upload owners resolve through their school foreign key.
            if owner.__class__.__name__ == "School":
                return str(owner.pk)
            school_id = getattr(owner, "school_id", None)
            if school_id is None and getattr(owner, "school", None) is not None:
                school_id = owner.school.pk
            if school_id is not None:
                return str(school_id)
        raise ImproperlyConfigured("A validated school owner context is required for this Cloudinary upload.")


class SchoolCloudinaryStorage(CloudinaryStorage):
    def __init__(self, **kwargs):
        super().__init__({"folder": "schools/logos", "images": True}, **kwargs)


class PrivateDocumentStorage(CloudinaryStorage):
    def __init__(self, **kwargs):
        super().__init__({"folder": "private", "private": True}, **kwargs)


class PublicImageStorage(CloudinaryStorage):
    def __init__(self, **kwargs):
        super().__init__({"folder": "public", "images": True}, **kwargs)


class LessonStorage(CloudinaryStorage):
    def __init__(self, **kwargs):
        super().__init__({"folder": "elearning/lessons", "school_scoped": True}, **kwargs)


class SubmissionStorage(CloudinaryStorage):
    def __init__(self, **kwargs):
        super().__init__({"folder": "elearning/submissions", "private": True, "school_scoped": True}, **kwargs)
