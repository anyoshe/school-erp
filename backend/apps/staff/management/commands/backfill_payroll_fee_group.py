"""
Backfill related_fee_category on payroll rows (and linked expenses)
that were paid before fee-group selection existed.

Examples:
  python manage.py backfill_payroll_fee_group --dry-run
  python manage.py backfill_payroll_fee_group
  python manage.py backfill_payroll_fee_group --fee-name Tuition
  python manage.py backfill_payroll_fee_group --school-id <uuid> --fee-name ICT
  python manage.py backfill_payroll_fee_group --only-paid
"""
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = "Backfill payroll fee group (related_fee_category) and linked expense allocation"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without saving",
        )
        parser.add_argument(
            "--fee-name",
            type=str,
            default="",
            help="Fee category name to assign (case-insensitive contains match). "
            "Default: prefer Tuition, then first active category per school.",
        )
        parser.add_argument(
            "--fee-id",
            type=str,
            default="",
            help="Exact FeeCategory UUID/id to assign (overrides --fee-name)",
        )
        parser.add_argument(
            "--school-id",
            type=str,
            default="",
            help="Limit to one school",
        )
        parser.add_argument(
            "--only-paid",
            action="store_true",
            help="Only rows with status=PAID (default: all missing fee group)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite payroll rows that already have a fee group",
        )

    def handle(self, *args, **options):
        from apps.staff.models import Payroll
        from apps.finance.models import FeeCategory

        dry = options["dry_run"]
        fee_name = (options["fee_name"] or "").strip()
        fee_id = (options["fee_id"] or "").strip()
        school_id = (options["school_id"] or "").strip()
        only_paid = options["only_paid"]
        force = options["force"]

        qs = Payroll.objects.select_related(
            "staff", "staff__school", "staff__user", "expense", "related_fee_category"
        )
        if not force:
            qs = qs.filter(related_fee_category__isnull=True)
        if only_paid:
            qs = qs.filter(status=Payroll.Status.PAID)
        if school_id:
            qs = qs.filter(staff__school_id=school_id)

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("Nothing to backfill."))
            return

        # Cache fee categories per school
        cat_cache = {}

        def resolve_category(school):
            if not school:
                return None
            key = str(school.id)
            if key in cat_cache:
                return cat_cache[key]
            cat = None
            if fee_id:
                cat = FeeCategory.objects.filter(pk=fee_id, school=school).first()
                if not cat:
                    cat = FeeCategory.objects.filter(pk=fee_id).first()
            elif fee_name:
                cat = (
                    FeeCategory.objects.filter(school=school, name__icontains=fee_name)
                    .order_by("name")
                    .first()
                )
            else:
                # Prefer tuition / school fee style names
                for needle in ("tuition", "school fee", "fees", "academic"):
                    cat = (
                        FeeCategory.objects.filter(school=school, name__icontains=needle)
                        .order_by("name")
                        .first()
                    )
                    if cat:
                        break
                if not cat:
                    cat = (
                        FeeCategory.objects.filter(school=school)
                        .order_by("name")
                        .first()
                    )
            cat_cache[key] = cat
            return cat

        updated = 0
        exp_updated = 0
        skipped = 0
        missing_cat = 0

        for row in qs.iterator(chunk_size=100):
            school = getattr(row.staff, "school", None)
            cat = resolve_category(school)
            if not cat:
                missing_cat += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"No fee category for school={school} payroll={row.id}"
                    )
                )
                continue

            name = ""
            if row.staff and row.staff.user:
                u = row.staff.user
                name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email

            if dry:
                self.stdout.write(
                    f"[dry] {name} · {row.month} · {row.status} → {cat.name}"
                )
                updated += 1
                if row.expense_id:
                    exp_updated += 1
                continue

            row.related_fee_category = cat
            row.save(update_fields=["related_fee_category", "updated_at"])
            updated += 1

            if row.expense_id:
                exp = row.expense
                # Always align expense fee group with payroll backfill
                if force or not exp.related_fee_category_id:
                    exp.related_fee_category = cat
                    # enrich description once
                    note = f" Funded from fee group: {cat.name}."
                    if note.strip() not in (exp.description or ""):
                        exp.description = ((exp.description or "") + note).strip()
                    exp.save(update_fields=["related_fee_category", "description"])
                    exp_updated += 1
            else:
                skipped += 1  # no expense row yet

        prefix = "[dry-run] " if dry else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Done. payroll_updated={updated} expenses_updated={exp_updated} "
                f"no_expense_link={skipped} missing_fee_category={missing_cat} candidates={total}"
            )
        )
        if dry:
            self.stdout.write("Re-run without --dry-run to apply.")
