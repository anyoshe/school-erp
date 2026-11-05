"""
Manually waive an invoice line for a student (backdate a waive that never hit the DB).

Examples:
  python manage.py waive_student_fee_line --admission PSS-2026-0019 --list
  python manage.py waive_student_fee_line --admission PSS-2026-0019 --amount 3000 --dry-run
  python manage.py waive_student_fee_line --admission PSS-2026-0019 --amount 3000
  python manage.py waive_student_fee_line --admission PSS-2026-0019 --description Fee
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.finance.clearance import adjust_invoice_line, recalculate_invoice_totals
from apps.finance.models import Invoice, InvoiceLine
from apps.students.models import Student


class Command(BaseCommand):
    help = "Waive a student invoice line by admission number + amount or description."

    def add_arguments(self, parser):
        parser.add_argument("--admission", required=True, help="e.g. PSS-2026-0019")
        parser.add_argument("--amount", type=str, default="", help="Line amount to waive (e.g. 3000)")
        parser.add_argument("--description", type=str, default="", help="Match description contains")
        parser.add_argument("--line-id", type=str, default="", help="Exact InvoiceLine UUID")
        parser.add_argument("--list", action="store_true", help="List invoice lines and exit")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        adm = options["admission"].strip()
        student = Student.objects.filter(admission_number__iexact=adm).first()
        if not student:
            self.stderr.write(self.style.ERROR(f"Student not found: {adm}"))
            return

        invoices = Invoice.objects.filter(student=student).order_by("-generated_at")
        lines = InvoiceLine.objects.filter(invoice__student=student).select_related("invoice")

        self.stdout.write(
            f"Student {student.admission_number} {student.first_name} {student.last_name} "
            f"invoices={invoices.count()} lines={lines.count()}"
        )
        for inv in invoices:
            self.stdout.write(
                f"  INV {inv.invoice_number} due={inv.amount_due} paid={inv.amount_paid} "
                f"bal={getattr(inv, 'balance', '?')}"
            )

        if options["list"] or (not options["amount"] and not options["description"] and not options["line_id"]):
            for ln in lines:
                self.stdout.write(
                    f"  line={ln.id} inv={ln.invoice.invoice_number} "
                    f"'{ln.description}' amount={ln.amount} original={ln.original_amount} "
                    f"waived={ln.is_waived}"
                )
            if options["list"]:
                return
            if not options["amount"] and not options["description"] and not options["line_id"]:
                self.stdout.write(self.style.WARNING("Pass --amount 3000 or --description ... or --line-id"))
                return

        qs = lines
        if options["line_id"]:
            qs = qs.filter(id=options["line_id"])
        if options["amount"]:
            amt = Decimal(str(options["amount"]))
            qs = qs.filter(amount=amt) | qs.filter(original_amount=amt)
            # distinct
            qs = InvoiceLine.objects.filter(id__in=qs.values_list("id", flat=True))
        if options["description"]:
            qs = qs.filter(description__icontains=options["description"].strip())

        qs = qs.select_related("invoice")
        found = list(qs)
        if not found:
            self.stderr.write(self.style.ERROR("No matching lines. Use --list to see options."))
            return
        if len(found) > 1 and not options["line_id"]:
            self.stdout.write(self.style.WARNING(f"{len(found)} matches — waive all of them or pass --line-id"))

        for ln in found:
            self.stdout.write(
                f"{'[dry] ' if options['dry_run'] else ''}Waive '{ln.description}' "
                f"amount={ln.amount} on {ln.invoice.invoice_number}"
            )
            if options["dry_run"]:
                continue
            adjust_invoice_line(
                ln,
                waived=True,
                reason="Backdated waive (management command)",
            )
            ln.refresh_from_db()
            inv = ln.invoice
            inv.refresh_from_db()
            self.stdout.write(
                self.style.SUCCESS(
                    f"  -> waived={ln.is_waived} line_amount={ln.amount} "
                    f"invoice_due={inv.amount_due} balance={inv.balance} paid={inv.amount_paid}"
                )
            )

        if not options["dry_run"]:
            for inv in Invoice.objects.filter(student=student):
                recalculate_invoice_totals(inv)
            inv = Invoice.objects.filter(student=student).order_by("-generated_at").first()
            if inv:
                inv.refresh_from_db()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Final {inv.invoice_number}: due={inv.amount_due} "
                        f"paid={inv.amount_paid} bal={inv.balance}"
                    )
                )
