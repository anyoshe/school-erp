from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.students.models import Student
from apps.finance.clearance import add_extra_fee_line, ensure_student_billing


class Command(BaseCommand):
    help = "Add (or re-add) an extra fee line on a clearance student by admission number"

    def add_arguments(self, parser):
        parser.add_argument("--admission", required=True)
        parser.add_argument("--description", default="Assessment book")
        parser.add_argument("--amount", type=str, default="300")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        adm = opts["admission"].strip()
        desc = opts["description"].strip()
        amount = Decimal(str(opts["amount"]))
        student = Student.objects.filter(admission_number__iexact=adm).first()
        if not student:
            self.stderr.write(self.style.ERROR(f"No student {adm}"))
            return
        billing = ensure_student_billing(student)
        lines = billing.get("lines") or []
        existing = [
            ln
            for ln in lines
            if desc.lower() in str(ln.get("description") or "").lower()
            and abs(float(ln.get("amount") or 0) - float(amount)) < 0.05
        ]
        if existing:
            self.stdout.write(
                self.style.WARNING(
                    f"Already present: {existing[0].get('description')} "
                    f"id={existing[0].get('id')} amount={existing[0].get('amount')} "
                    f"balance={billing.get('balance')}"
                )
            )
            return
        if opts["dry_run"]:
            self.stdout.write(
                f"[dry] would add {desc} {amount} for {adm}; current balance={billing.get('balance')}"
            )
            return
        line, inv, billing = add_extra_fee_line(student, desc, amount)
        self.stdout.write(
            self.style.SUCCESS(
                f"Added line {line.id} on {inv.invoice_number}: {desc} {amount}. "
                f"New balance={billing.get('balance')} lines={len(billing.get('lines') or [])}"
            )
        )
        for ln in billing.get("lines") or []:
            self.stdout.write(
                f"  - {ln.get('description')}: {ln.get('amount')} (id={ln.get('id')})"
            )
