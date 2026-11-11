from pathlib import Path

from rest_framework.exceptions import ValidationError


MAX_UPLOAD_BYTES = 20 * 1024 * 1024
ALLOWED_TYPES = {
    ".pdf": {b"%PDF-"},
    ".png": {b"\x89PNG\r\n\x1a\n"},
    ".jpg": {b"\xff\xd8\xff"},
    ".jpeg": {b"\xff\xd8\xff"},
    ".webp": {b"RIFF"},
}


def validate_upload(upload):
    suffix = Path(upload.name).suffix.lower()
    if suffix not in ALLOWED_TYPES:
        raise ValidationError("Only PDF, PNG, JPEG, and WebP files are allowed.")
    if upload.size <= 0:
        raise ValidationError("Empty files cannot be uploaded.")
    if upload.size > MAX_UPLOAD_BYTES:
        raise ValidationError("Files must be 20 MB or smaller.")
    safe_name = Path(upload.name.replace("\\", "/")).name
    if safe_name in {"", ".", ".."}:
        raise ValidationError("The filename is invalid.")
    upload.name = safe_name
    header = upload.read(12)
    upload.seek(0)
    signatures = ALLOWED_TYPES[suffix]
    valid = any(header.startswith(signature) for signature in signatures)
    if suffix == ".webp":
        valid = valid and header[8:12] == b"WEBP"
    if suffix == ".pdf":
        valid = valid and len(header) >= 8 and b"%%EOF" in upload.read()[-1024:]
        upload.seek(0)
    if not valid:
        raise ValidationError("The file content does not match its extension.")
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        try:
            from PIL import Image
            image = Image.open(upload)
            image.verify()
        except Exception as exc:
            raise ValidationError("The image file is invalid.") from exc
        finally:
            upload.seek(0)


def validate_image(upload):
    suffix = Path(upload.name).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise ValidationError("Only PNG, JPEG, and WebP images are allowed.")
    validate_upload(upload)
