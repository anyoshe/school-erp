from collections import Counter
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import connection
from django.db.models import Sum

from apps.finance.models import (
    Payment,
    Expense,
    IncomeReceipt,
    JournalEntry,
    JournalLine,
    CashLedgerEntry,
    Account,
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

        for school in School.objects.all():
            ensure_school_finance_defaults(school)
        self.stdout.write(f"Seeded accounts/categories for {School.objects.count()} school(s)")

        if force and not dry:
            types = ["payment"] if payments_only else ["payment", "expense", "income_receipt"]
            jqs = JournalEntry.objects.filter(source_type__in=types)
            n_j = jqs.count()
            # Delete in order; avoid server-side cursors (Neon pooler friendly)
            CashLedgerEntry.objects.filter(source_type__in=types).delete()
            JournalLine.objects.filter(entry__source_type__in=types).delete()
            jqs.delete()
            connection.close()  # drop any held server cursor after bulk delete
            self.stdout.write(f"Cleared {n_j} prior journal entries for {types}")

        pay_ok = pay_skip = pay_err = 0
        by_method = Counter()
        by_account = Counter()
        errors = []

        # Materialize IDs first — no server-side cursor over long-lived iterator
        pay_ids = list(
            Payment.objects.exclude(payment_method__in=["WAIVER", "SCHOLARSHIP", "TRANSFER"])
            .order_by("id")
            .values_list("id", flat=True)
        )
        self.stdout.write(f"Fee payments to consider: {len(pay_ids)}")

        for pk in pay_ids:
            if not force and JournalEntry.objects.filter(source_type="payment", source_id=str(pk)).exists():
                pay_skip += 1
                continue
            p = (
                Payment.objects.select_related(
                    "school",
                    "invoice",
                    "invoice__school",
                    "invoice__student",
                    "invoice__student__school",
                )
                .filter(pk=pk)
                .first()
            )
            if not p:
                continue
            method = p.payment_method or "CASH"
            by_method[method] += 1
            school = p.school or getattr(getattr(p, "invoice", None), "school", None)
            if school is None and getattr(p, "invoice", None) is not None:
                school = getattr(getattr(p.invoice, "student", None), "school", None)
            if school:
                acc = asset_account_for_payment_method(school, method)
                by_account[f"{getattr(acc, 'code', '?')} {getattr(acc, 'name', '')}"] += 1
            if dry:
                pay_ok += 1
                continue
            try:
                post_fee_payment(p)
                pay_ok += 1
            except Exception as e:
                pay_err += 1
                errors.append(f"payment {p.pk} ({method} {p.amount}): {e}")

        exp_ok = exp_skip = exp_err = 0
        inc_ok = inc_skip = inc_err = 0
        if not payments_only:
            exp_ids = list(Expense.objects.order_by("id").values_list("id", flat=True))
            for pk in exp_ids:
                if not force and JournalEntry.objects.filter(source_type="expense", source_id=str(pk)).exists():
                    exp_skip += 1
                    continue
                if dry:
                    exp_ok += 1
                    continue
                e = (
                    Expense.objects.select_related("school", "category", "paid_from_account")
                    .filter(pk=pk)
                    .first()
                )
                if not e:
                    continue
                try:
                    post_expense(e)
                    exp_ok += 1
                except Exception as err:
                    exp_err += 1
                    errors.append(f"expense {e.pk}: {err}")

            inc_ids = list(IncomeReceipt.objects.order_by("id").values_list("id", flat=True))
            for pk in inc_ids:
                if not force and JournalEntry.objects.filter(source_type="income_receipt", source_id=str(pk)).exists():
                    inc_skip += 1
                    continue
                if dry:
                    inc_ok += 1
                    continue
                r = IncomeReceipt.objects.select_related("school").filter(pk=pk).first()
                if not r:
                    continue
                try:
                    post_income_receipt(r)
                    inc_ok += 1
                except Exception as err:
                    inc_err += 1
                    errors.append(f"income_receipt {r.pk}: {err}")

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"{'[dry] would post' if dry else 'Posted'}: "
                f"payments={pay_ok} skipped={pay_skip} errors={pay_err}"
                + (
                    ""
                    if payments_only
                    else f" | expenses={exp_ok}/{exp_skip} err={exp_err} | income={inc_ok}/{inc_skip} err={inc_err}"
                )
            )
        )
        if by_method:
            self.stdout.write(
                "Payments by method: " + ", ".join(f"{k}={v}" for k, v in sorted(by_method.items()))
            )
        if by_account:
            self.stdout.write(
                "Mapped into accounts: " + ", ".join(f"{k}×{v}" for k, v in sorted(by_account.items()))
            )

        if not dry:
            self.stdout.write("")
            self.stdout.write("Asset account balances (from journal):")
            for school in School.objects.all():
                self.stdout.write(f"  School: {school.name}")
                for acc in Account.objects.filter(
                    school=school, account_type=Account.AccountType.ASSET
                ).order_by("code"):
                    agg = JournalLine.objects.filter(account=acc).aggregate(
                        d=Sum("debit"), c=Sum("credit")
                    )
                    bal = Decimal(str(agg["d"] or 0)) - Decimal(str(agg["c"] or 0))
                    self.stdout.write(
                        f"    {acc.code} {acc.name}: in={agg['d'] or 0} out={agg['c'] or 0} bal={bal}"
                    )

        for line in errors[:30]:
            self.stderr.write(line)
        if len(errors) > 30:
            self.stderr.write(f"... and {len(errors) - 30} more errors")
