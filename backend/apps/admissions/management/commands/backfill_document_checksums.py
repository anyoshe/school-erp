# apps/admissions/management/commands/backfill_document_checksums.py
import hashlib
from django.core.management.base import BaseCommand
from apps.admissions.models import ApplicationDocument


class Command(BaseCommand):
    help = "Backfill checksums for application documents"

    def handle(self, *args, **options):
        updated = 0

        qs = ApplicationDocument.objects.filter(checksum__isnull=True)

        for doc in qs.iterator():
            if not doc.file:
                continue

            hasher = hashlib.sha256()
            for chunk in doc.file.chunks():
                hasher.update(chunk)

            doc.checksum = hasher.hexdigest()
            doc.save(update_fields=["checksum"])
            updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Backfilled {updated} documents")
        )
