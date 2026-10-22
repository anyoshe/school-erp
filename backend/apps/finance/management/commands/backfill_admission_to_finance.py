"""
Backfill money recorded during admissions onto Finance for enrolled students.

Rules:
  - ApplicationCharge INTERVIEW/ADMISSION with amount_paid > 0
      → IncomeReceipt (interview / admission income)
  - AdmissionFeePayment on applications that have a Student
      → finance.Payment against the student's invoices (school fees),
        unless the row is clearly only a registration/admission fee
        AND an ApplicationCharge already covers it.
  - Students in PENDING_CLEARANCE with any school-fee Payment → ACTIVE
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q, Sum
from django.utils import timezone


class Command(BaseCommand):
    help = "Move admission-time collections into Finance (fees + income receipts) for enrolled students"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print actions without writing",
        )
        parser.add_argument(
            "--school-id",
            type=str,
            default="",
            help="Limit to one school UUID",
        )

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionFeePayment, Application, ApplicationCharge
        from apps.finance.models import Invoice, Payment, StudentFeeAssignment
        from apps.finance.pre_enrollment import post_charge_to_finance
        from apps.students.models import Student

        dry = options["dry_run"]
        school_id = (options.get("school_id") or "").strip()

        created_payments = 0
        created_receipts = 0
        activated = 0
        skipped_no_student = 0
        skipped_no_invoice = 0
        skipped_dup = 0

        # ── 1) True interview / admission charges → IncomeReceipt ───────────
        charges = ApplicationCharge.objects.select_related(
            "application", "application__student", "application__school"
        ).filter(amount_paid__gt=0)
        if school_id:
            charges = charges.filter(application__school_id=school_id)

        for ch in charges.iterator():
            student = getattr(ch.application, "student", None)
            if dry:
                self.stdout.write(
                    f"[dry] IncomeReceipt {ch.charge_type} {ch.amount_paid} app={ch.application_id}"
                )
                created_receipts += 1
                continue
            try:
                r = post_charge_to_finance(ch, student=student)
                if r:
                    created_receipts += 1
            except Exception as e:
                self.stderr.write(f"IncomeReceipt failed charge={ch.id}: {e}")

        # ── 2) AdmissionFeePayment → school fee Payment on student invoices ─
        pays = AdmissionFeePayment.objects.select_related(
            "application", "application__student", "application__school"
        ).all()
        if school_id:
            pays = pays.filter(application__school_id=school_id)

        for row in pays.iterator():
            app = row.application
            student = getattr(app, "student", None)
            if not student:
                skipped_no_student += 1
                continue

            method = (row.payment_method or "").lower()
            # Skip pure registration labels only when an ADMISSION charge already captured it
            looks_admission_only = (
                "registration" in method
                or (method in ("admission", "admission fee") and "school" not in method)
            )
            if looks_admission_only:
                has_adm_charge = ApplicationCharge.objects.filter(
                    application=app,
                    charge_type="ADMISSION",
                    amount_paid__gt=0,
                ).exists()
                if has_adm_charge:
                    skipped_dup += 1
                    continue

            amt = Decimal(str(row.amount or 0))
            if amt <= 0:
                continue

            school = app.school
            invoices = list(
                Invoice.objects.filter(student=student).order_by("due_date", "generated_at", "id")
            )
            if not invoices:
                # Try ensure assignment exists if fee_structure on student
                fs = getattr(student, "fee_structure", None)
                if fs and not dry:
                    try:
                        StudentFeeAssignment.objects.get_or_create(
                            student=student,
                            defaults={"fee_structure": fs},
                        )
                        invoices = list(
                            Invoice.objects.filter(student=student).order_by("due_date", "id")
                        )
                    except Exception as e:
                        self.stderr.write(f"Could not assign fees student={student.id}: {e}")

            if not invoices:
                skipped_no_invoice += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"No invoice for student {student.admission_number} "
                        f"({student.full_name}) — assign fee structure in Finance first"
                    )
                )
                continue

            # Already backfilled?
            ref = (row.receipt_number or "").strip()
            if Payment.objects.filter(
                invoice__student=student,
                notes__icontains="backfill",
                amount=amt,
            ).filter(
                Q(reference_number=ref) | Q(notes__icontains=str(row.id)[:8])
            ).exists():
                skipped_dup += 1
                continue
            if ref and Payment.objects.filter(
                invoice__student=student, reference_number=ref, amount=amt
            ).exists():
                skipped_dup += 1
                continue

            remaining = amt
            for inv in invoices:
                if remaining <= 0:
                    break
                try:
                    outstanding = Decimal(str(inv.current_total_due or inv.amount_due or 0)) - Decimal(
                        str(inv.amount_paid or 0)
                    )
                except Exception:
                    outstanding = Decimal(str(getattr(inv, "balance", 0) or 0))
                if outstanding <= 0:
                    continue
                pay_amt = min(remaining, outstanding)
                note = (
                    f"Admission-time collection posted to school fees (backfill) "
                    f"src=AdmissionFeePayment:{row.id}"
                )
                if dry:
                    self.stdout.write(
                        f"[dry] Payment {pay_amt} → invoice {inv.invoice_number} "
                        f"student={student.admission_number}"
                    )
                else:
                    Payment.objects.create(
                        school=school,
                        invoice=inv,
                        amount=pay_amt,
                        payment_method="CASH",
                        reference_number=ref[:100],
                        notes=note,
                    )
                created_payments += 1
                remaining -= pay_amt

            # Overpayment with no more invoice balance: still record on first invoice as note
            if remaining > 0 and invoices:
                inv = invoices[0]
                if dry:
                    self.stdout.write(
                        f"[dry] Payment (over) {remaining} → {inv.invoice_number}"
                    )
                else:
                    Payment.objects.create(
                        school=school,
                        invoice=inv,
                        amount=remaining,
                        payment_method="CASH",
                        reference_number=ref[:100],
                        notes=(
                            f"Admission-time collection surplus (backfill) "
                            f"src=AdmissionFeePayment:{row.id}"
                        ),
                    )
                created_payments += 1

        # ── 3) Activate enrolled students pending clearance who now have fees paid ──
        qs = Student.objects.filter(status="PENDING_CLEARANCE")
        if school_id:
            qs = qs.filter(school_id=school_id)
        for student in qs.iterator():
            has_pay = Payment.objects.filter(invoice__student=student).exclude(
                payment_method="TRANSFER"
            ).exists()
            if not has_pay:
                continue
            if dry:
                self.stdout.write(f"[dry] Activate {student.admission_number}")
            else:
                student.status = "ACTIVE"
                student.save(update_fields=["status"])
            activated += 1

        # Also activate already-enrolled students stuck on PENDING if they had old payments
        # (handled above)

        self.stdout.write(self.style.SUCCESS(
            f"Done. payments={created_payments} income_receipts={created_receipts} "
            f"activated={activated} skipped_no_student={skipped_no_student} "
            f"skipped_no_invoice={skipped_no_invoice} skipped_dup={skipped_dup}"
            + (" (dry-run)" if dry else "")
        ))
