"""
Seed free starter digital resources into a school's library.

Idempotent: uses licence_type=STARTER_PACK + external_url (or title) so
re-running does not create duplicates. Schools may delete individual rows;
calling seed again only restores missing catalog keys.
"""
from __future__ import annotations

from typing import Iterable, Optional

from .models import DigitalResource
from .starter_catalog import STARTER_DIGITAL_RESOURCES, catalog_for_levels


STARTER_LICENCE = "STARTER_PACK"


def seed_library_starter_pack(
    school,
    *,
    levels: Optional[Iterable[str]] = None,
    only_missing: bool = True,
    approved: bool = True,
) -> dict:
    """
    Copy curated free links into school.DigitalResource rows.

    Returns counts: created, skipped, total_catalog.
    """
    catalog = catalog_for_levels(levels)
    created = 0
    skipped = 0

    status_approved = DigitalResource.ApprovalStatus.APPROVED
    status_pending = DigitalResource.ApprovalStatus.PENDING
    approval = status_approved if approved else status_pending

    for row in catalog:
        url = (row.get("external_url") or "").strip()
        title = (row.get("title") or "").strip()
        if not title:
            skipped += 1
            continue

        # Match existing starter row for this school
        qs = DigitalResource.objects.filter(
            school=school,
            licence_type=STARTER_LICENCE,
        )
        if url:
            existing = qs.filter(external_url=url).first()
        else:
            existing = qs.filter(title__iexact=title).first()

        if existing:
            skipped += 1
            continue

        # Also avoid clashing with a school-added resource that already has same URL
        if only_missing and url:
            if DigitalResource.objects.filter(school=school, external_url=url).exists():
                skipped += 1
                continue

        DigitalResource.objects.create(
            school=school,
            title=title,
            author=row.get("copyright_owner") or "",
            publisher=row.get("copyright_owner") or "",
            description=row.get("description") or "",
            resource_type=row.get("resource_type") or DigitalResource.ResourceType.EXTERNAL,
            external_url=url,
            grade_levels=row.get("grade_levels") or "",
            subject=row.get("subject") or "",
            curriculum=row.get("curriculum") or "CBC",
            language=row.get("language") or "English",
            copyright_owner=row.get("copyright_owner") or "",
            licence_type=STARTER_LICENCE,
            allow_download=bool(row.get("allow_download")),
            allow_redistribute=False,
            visibility=DigitalResource.Visibility.SCHOOL,
            approval_status=approval,
        )
        created += 1

    return {
        "created": created,
        "skipped": skipped,
        "catalog_size": len(catalog),
        "school_id": str(school.id),
        "school_name": getattr(school, "name", ""),
    }


def seed_all_schools(**kwargs) -> list:
    from apps.school.models import School

    results = []
    for school in School.objects.all().iterator():
        results.append(seed_library_starter_pack(school, **kwargs))
    return results
