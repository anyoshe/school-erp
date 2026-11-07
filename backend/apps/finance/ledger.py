"""
Double-entry posting for school fee payments, expenses, and income receipts.

Convention (school cash basis):
  Fee payment:   Dr Asset (Cash/Bank/M-Pesa)   Cr Income (School fee income)
  Expense:       Dr Expense GL                  Cr Asset (paid-from account)
  Income receipt:Dr Asset                       Cr Income (admission/interview)
"""
from __future__ import annotations

from decimal import Decimal
from django.db import transaction
from django.utils import timezone


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


def _account(school, code: str):
    from apps.finance.seed_defaults import ensure_school_cash_accounts
    from apps.finance.models import Account
    ensure_school_cash_accounts(school)
    return Account.objects.filter(school=school, code=code).first()


def _already_posted(source_type: str, source_id) -> bool:
    from apps.finance.models import JournalEntry
    if not source_id:
        return False
    return JournalEntry.objects.filter(source_type=source_type, source_id=str(source_id)).exists()


@transaction.atomic
def post_journal(school, entry_date, memo, lines, source_type="", source_id=None):
    """
    lines: list of {account, debit=0, credit=0, memo=""}
    Must balance.
    """
    from apps.finance.models import JournalEntry, JournalLine, CashLedgerEntry

    if source_id and _already_posted(source_type, source_id):
        return JournalEntry.objects.filter(source_type=source_type, source_id=str(source_id)).first()

    deb = sum(_d(x.get("debit")) for x in lines)
    cre = sum(_d(x.get("credit")) for x in lines)
    if deb <= 0 and cre <= 0:
        return None
    if abs(deb - cre) > Decimal("0.02"):
        raise ValueError(f"Unbalanced journal: debit={deb} credit={cre} memo={memo}")

    entry = JournalEntry.objects.create(
        school=school,
        entry_date=entry_date or timezone.now().date(),
        memo=(memo or "")[:255],
        source_type=source_type or "",
        source_id=str(source_id) if source_id is not None else "",
    )
    for row in lines:
        acc = row.get("account")
        if not acc:
            continue
        d, c = _d(row.get("debit")), _d(row.get("credit"))
        if d == 0 and c == 0:
            continue
        JournalLine.objects.create(
            entry=entry,
            account=acc,
            debit=d,
            credit=c,
            memo=(row.get("memo") or "")[:255],
        )
        # Mirror cash movements on asset accounts into CashLedgerEntry
        from apps.finance.models import Account
        if acc.account_type == Account.AccountType.ASSET and (d > 0 or c > 0):
            CashLedgerEntry.objects.create(
                school=school,
                account=acc,
                direction=CashLedgerEntry.Direction.IN if d > 0 else CashLedgerEntry.Direction.OUT,
                amount=d if d > 0 else c,
                entry_date=entry.entry_date,
                description=(memo or "")[:255],
                reference_number=(row.get("reference") or "")[:100],
                source_type=source_type or "",
                source_id=str(source_id) if source_id is not None else "",
            )
    return entry


def post_fee_payment(payment) -> None:
    """Dr cash pot, Cr school fee income."""
    from apps.finance.seed_defaults import asset_account_for_payment_method
    from apps.finance.models import Account

    if (payment.payment_method or "").upper() in ("WAIVER", "SCHOLARSHIP", "TRANSFER"):
        return  # non-cash

    school = payment.school or getattr(getattr(payment, "invoice", None), "school", None)
    if not school and getattr(payment, "invoice", None):
        school = getattr(getattr(payment.invoice, "student", None), "school", None)
    if not school:
        return
    amount = _d(payment.amount)
    if amount <= 0:
        return

    asset = asset_account_for_payment_method(school, payment.payment_method)
    income = _account(school, "4000")
    if not asset or not income:
        return

    inv_no = getattr(getattr(payment, "invoice", None), "invoice_number", "") or ""
    student = getattr(getattr(payment, "invoice", None), "student", None)
    name = ""
    if student:
        name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
    memo = f"Fee payment {payment.receipt_number or payment.id} · {inv_no} · {name}".strip(" ·")

    post_journal(
        school,
        payment.payment_date or timezone.now().date(),
        memo,
        [
            {"account": asset, "debit": amount, "credit": 0, "reference": payment.reference_number or payment.receipt_number or ""},
            {"account": income, "debit": 0, "credit": amount},
        ],
        source_type="payment",
        source_id=str(payment.pk),
    )


def post_expense(expense) -> None:
    """Dr expense GL, Cr paid-from asset."""
    school = expense.school
    amount = _d(expense.amount)
    if not school or amount <= 0:
        return
    asset = expense.paid_from_account
    if not asset:
        from apps.finance.seed_defaults import asset_account_for_payment_method
        asset = asset_account_for_payment_method(school, expense.payment_method)
    # Prefer salaries GL when category name suggests payroll
    exp_gl = _account(school, "5100")
    cat_name = (getattr(getattr(expense, "category", None), "name", "") or "").lower()
    if "salar" not in cat_name and "wage" not in cat_name and "payroll" not in cat_name:
        exp_gl = _account(school, "5000")
    if not asset or not exp_gl:
        return
    post_journal(
        school,
        expense.expense_date,
        f"Expense: {expense.title}",
        [
            {"account": exp_gl, "debit": amount, "credit": 0},
            {"account": asset, "debit": 0, "credit": amount, "reference": expense.reference_number or ""},
        ],
        source_type="expense",
        source_id=expense.id,
    )


def post_income_receipt(receipt) -> None:
    """Dr cash, Cr admission/interview income."""
    school = receipt.school
    amount = _d(receipt.amount)
    if not school or amount <= 0:
        return
    from apps.finance.seed_defaults import asset_account_for_payment_method
    asset = asset_account_for_payment_method(school, getattr(receipt, "payment_method", "CASH"))
    src = (getattr(receipt, "source", "") or "").upper()
    code = "4010" if src == "ADMISSION" else "4020" if src == "INTERVIEW" else "4090"
    income = _account(school, code) or _account(school, "4090")
    if not asset or not income:
        return
    post_journal(
        school,
        getattr(receipt, "paid_at", None).date() if getattr(receipt, "paid_at", None) else timezone.now().date(),
        f"Income receipt {src}",
        [
            {"account": asset, "debit": amount, "credit": 0, "reference": getattr(receipt, "reference_number", "") or ""},
            {"account": income, "debit": 0, "credit": amount},
        ],
        source_type="income_receipt",
        source_id=receipt.id,
    )
