from django.core.management.base import BaseCommand
from apps.finance.models import Payment, Expense, IncomeReceipt, JournalEntry
from apps.finance.ledger import post_fee_payment, post_expense, post_income_receipt


class Command(BaseCommand):
    help = "Post historical payments/expenses/income receipts into double-entry journal"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        dry = opts["dry_run"]
        pay_n = exp_n = inc_n = 0
        for p in Payment.objects.exclude(payment_method__in=["WAIVER", "SCHOLARSHIP", "TRANSFER"]).iterator():
            if JournalEntry.objects.filter(source_type="payment", source_id=str(p.pk)).exists():
                continue
            if dry:
                pay_n += 1
                continue
            try:
                post_fee_payment(p)
                pay_n += 1
            except Exception as e:
                self.stderr.write(f"payment {p.pk}: {e}")
        for e in Expense.objects.all().iterator():
            if JournalEntry.objects.filter(source_type="expense", source_id=str(e.pk)).exists():
                continue
            if dry:
                exp_n += 1
                continue
            try:
                post_expense(e)
                exp_n += 1
            except Exception as err:
                self.stderr.write(f"expense {e.pk}: {err}")
        for r in IncomeReceipt.objects.all().iterator():
            if JournalEntry.objects.filter(source_type="income_receipt", source_id=str(r.pk)).exists():
                continue
            if dry:
                inc_n += 1
                continue
            try:
                post_income_receipt(r)
                inc_n += 1
            except Exception as err:
                self.stderr.write(f"receipt {r.pk}: {err}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{'[dry] would post' if dry else 'Posted'}: payments={pay_n} expenses={exp_n} income_receipts={inc_n}"
            )
        )
