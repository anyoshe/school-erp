"""
Management command to auto-generate invoices for students without invoices.
Useful for:
- Processing new term enrollments
- Batch creating invoices for existing assignments
- Backfilling invoices for manually-created assignments
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from apps.finance.models import StudentFeeAssignment, Invoice
from django.db.models import Q


class Command(BaseCommand):
    help = 'Generate invoices for students who have fee assignments but no invoices'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force regenerate invoices even if they already exist',
        )
        parser.add_argument(
            '--assignment-id',
            type=str,
            help='Generate invoices only for a specific assignment ID',
        )
        parser.add_argument(
            '--year',
            type=str,
            help='Generate invoices for a specific academic year',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        assignment_id = options.get('assignment_id')
        academic_year = options.get('year')

        # Build query
        query = StudentFeeAssignment.objects.select_related('student', 'fee_structure', 'payment_plan').all()

        if assignment_id:
            query = query.filter(id=assignment_id)

        # Filter out those with invoices (unless force)
        if not force:
            # Get assignment IDs that have invoices
            assignments_with_invoices = Invoice.objects.values_list('fee_assignment_id', flat=True).distinct()
            query = query.exclude(id__in=assignments_with_invoices)

        assignments = query

        if not assignments.exists():
            self.stdout.write(
                self.style.WARNING('No assignments to process.')
            )
            return

        self.stdout.write(
            self.style.SUCCESS(f'Processing {assignments.count()} assignment(s)...')
        )

        created_count = 0
        error_count = 0

        for assignment in assignments:
            try:
                created = self._generate_invoices(assignment, academic_year)
                created_count += created
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ {assignment.student.full_name}: {created} invoice(s) created'
                    )
                )
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f'✗ {assignment.student.full_name}: {str(e)}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nSummary: {created_count} invoices created, {error_count} errors'
            )
        )

    def _generate_invoices(self, assignment, academic_year=None):
        """Generate invoices for a single assignment"""
        plan = assignment.payment_plan
        
        # Delete existing invoices if force regenerate
        if Invoice.objects.filter(fee_assignment=assignment).exists():
            Invoice.objects.filter(fee_assignment=assignment).delete()

        start_date = timezone.now().date()
        academic_year = academic_year or (assignment.fee_structure.academic_year if assignment.fee_structure else "2026")
        term = assignment.fee_structure.period_name if assignment.fee_structure else "Term 1"

        # Single payment (no plan or 1 installment) or custom partial plan
        if not plan or plan.number_of_installments <= 1 or plan.plan_type.lower() == 'custom':
            due_date = start_date + timedelta(days=14)
            if plan and plan.days_interval:
                due_date = start_date + timedelta(days=plan.days_interval)
            if plan and plan.plan_type.lower() == 'custom' and getattr(assignment, 'custom_due_date', None):
                due_date = assignment.custom_due_date

            Invoice.objects.create(
                student=assignment.student,
                fee_assignment=assignment,
                school=assignment.student.school,
                payment_plan=plan,
                term=term,
                academic_year=academic_year,
                amount_due=assignment.remaining_total,
                due_date=due_date,
                generated_by=None,
            )
            return 1

        # Multiple installments
        total_amount = assignment.remaining_total
        num_installments = plan.number_of_installments
        amount_per_installment = total_amount / num_installments

        interval_map = {
            'weekly': 7,
            'monthly': 30,
            'quarterly': 90,
            'semester': 120,
            'termly': 120,
        }
        days_step = plan.days_interval or interval_map.get(plan.plan_type.lower(), 30)

        for i in range(num_installments):
            due_date = start_date + timedelta(days=((i + 1) * days_step))
            
            Invoice.objects.create(
                student=assignment.student,
                fee_assignment=assignment,
                school=assignment.student.school,
                payment_plan=plan,
                installment_number=i + 1,
                term=term,
                academic_year=academic_year,
                amount_due=amount_per_installment,
                due_date=due_date,
                generated_by=None,
            )

        return num_installments
