from collections import Counter
from django.core.management.base import BaseCommand
from django.db.models import Prefetch

from apps.finance.models import (
    Payment, Expense, IncomeReceipt, JournalEntry, JournalLine, CashLedgerEntry, Account,
)
from apps.finance.ledger import post_fee_payment, post_expense, post_income_receipt
from apps.finance.seed_defaults import ensure_school_finance_defaults, asset_account_for_payment_method
from apps.school.models import School


class Command(BaseCommand):
    help = (
        "Post historical fee payments / expenses / income receipts into double-entry "
        "journal so Cash / Bank / M-Pesa balances reflect money already received."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing payment/expense/income_receipt journals and re-post",
        )
        parser.add_argument(
            "--payments-only",
            action="store_true",
            help="Only backfill fee payments into cash/bank/mpesa",
        )

    def handle(self, *args, **opts):
        dry = opts["dry_run"]
        force = opts["force"]
        payments_only = opts["payments_only"]

        # Ensure chart of accounts for every school first
        for school in School.objects.all():
            ensure_school_finance_defaults(school)
        self.stdout.write(f"Seeded accounts/categories for {School.objects.count()} school(s)")

        if force and not dry:
            types = ["payment"] if payments_only else ["payment", "expense", "income_receipt"]
            jqs = JournalEntry.objects.filter(source_type__in=types)
            n_j = jqs.count()
            CashLedgerEntry.objects.filter(source_type__in=types).delete()
            jqs.delete()
            self.stdout.write(f"Cleared {n_j} prior journal entries for {types}")

        pay_ok = pay_skip = pay_err = 0
        by_method = Counter()
        by_account = Counter()
        errors = []

        qs = (
            Payment.objects.exclude(payment_method__in=["WAIVER", "SCHOLARSHIP", "TRANSFER"])
            .select_related("school", "invoice", "invoice__school", "invoice__student", "invoice__student__school")
            .order_by("id")
        )
        total_pay = qs.count()
        self.stdout.write(f"Fee payments to consider: {total_pay}")

        for p in qs.iterator(chunk_size=200):
            if not force and JournalEntry.objects.filter(source_type="payment", source_id=str(p.pk)).exists():
                pay_skip += 1
                continue
            method = p.payment_method or "CASH"
            by_method[method] += 1
            if dry:
                school = p.school or getattr(getattr(p, "invoice", None), "school", None)
                if school is None and getattr(p, "invoice", None) is not None:
                    school = getattr(getattr(p.invoice, "student", None), "school", None)
                if school:
                    acc = asset_account_for_payment_method(school, method)
                    by_account[getattr(acc, "code", "?") + " " + getattr(acc, "name", "")] += 1
                pay_ok += 1
                continue
            try:
                post_fee_payment(p)
                pay_ok += 1
                # Resolve posted account for report
                school = p.school or getattr(getattr(p, "invoice", None), "school", None)
                if school is None and getattr(p, "invoice", None) is not None:
                    school = getattr(getattr(p.invoice, "student", None), "school", None)
                if school:
                    acc = asset_account_for_payment_method(school, method)
                    by_account[getattr(acc, "code", "?") + " " + getattr(acc, "name", "")] += 1
            except Exception as e:
                pay_err += 1
                errors.append(f"payment {p.pk} ({method} {p.amount}): {e}")

        exp_ok = exp_skip = exp_err = 0
        inc_ok = inc_skip = inc_err = 0
        if not payments_only:
            for e in Expense.objects.select_related("school", "category", "paid_from_account").iterator():
                if not force and JournalEntry.objects.filter(source_type="expense", source_id=str(e.pk)).exists():
                    exp_skip += 1
                    continue
                if dry:
                    exp_ok += 1
                    continue
                try:
                    post_expense(e)
                    exp_ok += 1
                except Exception as err:
                    exp_err += 1
                    errors.append(f"expense {e.pk}: {err}")

            for r in IncomeReceipt.objects.select_related("school").iterator():
                if not force and JournalEntry.objects.filter(source_type="income_receipt", source_id=str(r.pk)).exists():
                    inc_skip += 1
                    continue
                if dry:
                    inc_ok += 1
                    continue
                try:
                    post_income_receipt(r)
                    inc_ok += 1
                except Exception as err:
                    inc_err += 1
                    errors.append(f"income_receipt {r.pk}: {err}")

        # Summary of cash pot balances after post
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"{'[dry] would post' if dry else 'Posted'}: "
            f"payments={pay_ok} skipped={pay_skip} errors={pay_err}"
            + ("" if payments_only else f" | expenses={exp_ok}/{exp_skip} err={exp_err} | income={inc_ok}/{inc_skip} err={inc_err}")
        ))
        if by_method:
            self.stdout.write("Payments by method: " + ", ".join(f"{k}={v}" for k, v in sorted(by_method.items())))
        if by_account:
            self.stdout.write("Mapped into accounts: " + ", ".join(f"{k}×{v}" for k, v in sorted(by_account.items())))

        if not dry:
            self.stdout.write("")
            self.stdout.write("Asset account balances (from journal):")
            for school in School.objects.all():
                self.stdout.write(f"  School: {school.name}")
                for acc in Account.objects.filter(school=school, account_type=Account.AccountType.ASSET).order_by("code"):
                    from django.db.models import Sum
                    from decimal import Decimal
                    agg = JournalLine.objects.filter(account=acc).aggregate(d=Sum("debit"), c=Sum("credit"))
                    bal = Decimal(str(agg["d"] or 0)) - Decimal(str(agg["c"] or 0))
                    self.stdout.write(
                        f"    {acc.code} {acc.name}: in={agg['d'] or 0} out={agg['c'] or 0} bal={bal}"
                    )

        for line in errors[:30]:
            self.stderr.write(line)
        if len(errors) > 30:
            self.stderr.write(f"... and {len(errors) - 30} more errors")
