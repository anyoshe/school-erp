from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.finance.models import Invoice


class Command(BaseCommand):
    help = 'Fix invoices with negative stored balance values by recalculating and normalizing them.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show which invoices would be fixed without saving changes.',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Fix all invoices, including those with balance inconsistencies but not currently negative.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        include_all = options['all']

        invoices = Invoice.objects.all()
        if not include_all:
            invoices = invoices.filter(balance__lt=0)

        total = invoices.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS('No negative invoice balances found.'))
            return

        self.stdout.write(self.style.WARNING(f'Found {total} invoice(s) to inspect.'))

        fixed_count = 0
        for invoice in invoices:
            recalculated_balance = max(Decimal('0'), invoice.current_total_due - invoice.amount_paid)
            recalculated_is_paid = invoice.amount_paid >= invoice.current_total_due
            if invoice.balance != recalculated_balance or invoice.is_paid != recalculated_is_paid:
                self.stdout.write(
                    f'Invoice {invoice.invoice_number} ({invoice.student.full_name}): '
                    f'balance {invoice.balance} -> {recalculated_balance}, '
                    f'is_paid {invoice.is_paid} -> {recalculated_is_paid}'
                )
                if not dry_run:
                    invoice.balance = recalculated_balance
                    invoice.is_paid = recalculated_is_paid
                    if invoice.is_paid and not invoice.paid_at:
                        invoice.paid_at = timezone.now()
                    invoice.save(update_fields=['balance', 'is_paid', 'paid_at'])
                fixed_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Processed {total} invoice(s). {fixed_count} invoice(s) had changes applied.'
            )
        )
