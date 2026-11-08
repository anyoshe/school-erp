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


def _sid(source_id) -> str:
    if source_id is None:
        return ""
    return str(source_id)


def _account(school, code: str):
    from apps.finance.seed_defaults import ensure_school_cash_accounts
    from apps.finance.models import Account
    ensure_school_cash_accounts(school)
    return Account.objects.filter(school=school, code=code).first()


def _school_from_payment(payment):
    school = getattr(payment, "school", None)
    if school is not None:
        return school
    inv = getattr(payment, "invoice", None)
    if inv is None and getattr(payment, "invoice_id", None):
        from apps.finance.models import Invoice
        inv = Invoice.objects.select_related("school", "student", "student__school").filter(pk=payment.invoice_id).first()
    if inv is not None:
        school = getattr(inv, "school", None)
        if school is not None:
            return school
        student = getattr(inv, "student", None)
        if student is not None:
            return getattr(student, "school", None)
    return None


def _already_posted(source_type: str, source_id) -> bool:
    from apps.finance.models import JournalEntry
    sid = _sid(source_id)
    if not sid:
        return False
    return JournalEntry.objects.filter(source_type=source_type, source_id=sid).exists()


@transaction.atomic
def post_journal(school, entry_date, memo, lines, source_type="", source_id=None):
    """
    lines: list of {account, debit=0, credit=0, memo="", reference=""}
    Must balance.
    """
    from apps.finance.models import JournalEntry, JournalLine, CashLedgerEntry, Account

    sid = _sid(source_id)
    if sid and _already_posted(source_type, sid):
        return JournalEntry.objects.filter(source_type=source_type, source_id=sid).first()

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
        source_id=sid,
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
                source_id=sid,
            )
    return entry


def post_fee_payment(payment) -> bool:
    """Dr cash pot, Cr school fee income. Returns True if posted (or already existed)."""
    from apps.finance.seed_defaults import asset_account_for_payment_method

    method = (payment.payment_method or "CASH").upper()
    if method in ("WAIVER", "SCHOLARSHIP", "TRANSFER"):
        return False

    school = _school_from_payment(payment)
    if not school:
        raise ValueError(f"payment {getattr(payment, 'pk', None)}: no school")

    amount = _d(payment.amount)
    if amount <= 0:
        return False

    if _already_posted("payment", payment.pk):
        return True

    asset = asset_account_for_payment_method(school, payment.payment_method)
    income = _account(school, "4000")
    if not asset or not income:
        raise ValueError(f"payment {payment.pk}: missing asset/income accounts for school {school.id}")

    inv_no = getattr(getattr(payment, "invoice", None), "invoice_number", "") or ""
    student = getattr(getattr(payment, "invoice", None), "student", None)
    name = ""
    if student:
        name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
    memo = f"Fee payment {payment.receipt_number or payment.pk} · {inv_no} · {name}".strip(" ·")

    post_journal(
        school,
        payment.payment_date or timezone.now().date(),
        memo,
        [
            {
                "account": asset,
                "debit": amount,
                "credit": 0,
                "reference": payment.reference_number or payment.receipt_number or "",
            },
            {"account": income, "debit": 0, "credit": amount},
        ],
        source_type="payment",
        source_id=payment.pk,
    )
    return True


def post_expense(expense) -> bool:
    """Dr expense GL, Cr paid-from asset."""
    school = expense.school
    amount = _d(expense.amount)
    if not school or amount <= 0:
        return False
    if _already_posted("expense", expense.pk):
        return True

    asset = expense.paid_from_account
    if not asset:
        from apps.finance.seed_defaults import asset_account_for_payment_method
        asset = asset_account_for_payment_method(school, expense.payment_method)

    cat_name = (getattr(getattr(expense, "category", None), "name", "") or "").lower()
    if any(k in cat_name for k in ("salar", "wage", "payroll", "nssf", "nhif")):
        exp_gl = _account(school, "5100")
    else:
        exp_gl = _account(school, "5000")
    if not asset or not exp_gl:
        raise ValueError(f"expense {expense.pk}: missing accounts")

    post_journal(
        school,
        expense.expense_date,
        f"Expense: {expense.title}",
        [
            {"account": exp_gl, "debit": amount, "credit": 0},
            {
                "account": asset,
                "debit": 0,
                "credit": amount,
                "reference": expense.reference_number or "",
            },
        ],
        source_type="expense",
        source_id=expense.pk,
    )
    return True


def post_income_receipt(receipt) -> bool:
    """Dr cash, Cr admission/interview income."""
    school = receipt.school
    amount = _d(receipt.amount)
    if not school or amount <= 0:
        return False
    if _already_posted("income_receipt", receipt.pk):
        return True

    from apps.finance.seed_defaults import asset_account_for_payment_method
    asset = asset_account_for_payment_method(school, getattr(receipt, "payment_method", "CASH"))
    src = (getattr(receipt, "source", "") or "").upper()
    code = "4010" if src == "ADMISSION" else "4020" if src == "INTERVIEW" else "4090"
    income = _account(school, code) or _account(school, "4090")
    if not asset or not income:
        raise ValueError(f"income_receipt {receipt.pk}: missing accounts")

    paid_at = getattr(receipt, "paid_at", None)
    entry_date = paid_at.date() if paid_at else timezone.now().date()
    post_journal(
        school,
        entry_date,
        f"Income receipt {src}",
        [
            {
                "account": asset,
                "debit": amount,
                "credit": 0,
                "reference": getattr(receipt, "reference_number", "") or "",
            },
            {"account": income, "debit": 0, "credit": amount},
        ],
        source_type="income_receipt",
        source_id=receipt.pk,
    )
    return True



def post_payroll(payroll, *, payment_method=None, paid_from_account=None, user=None) -> bool:
    """
    Mark a payroll row as paid in the GL:
      Dr 5100 Staff salaries
      Cr Cash/Bank/M-Pesa (asset)

    Also creates a Finance Expense under "Staff salaries" so P&L and expense
    register stay aligned. Idempotent via JournalEntry source_type=payroll.
    """
    from apps.finance.models import Expense, ExpenseCategory, Account
    from apps.finance.seed_defaults import (
        ensure_school_expense_categories,
        ensure_school_cash_accounts,
        asset_account_for_payment_method,
    )

    staff = payroll.staff
    school = getattr(staff, "school", None)
    amount = _d(payroll.net_salary)
    if not school or amount <= 0:
        return False
    if _already_posted("payroll", payroll.pk):
        return True

    ensure_school_expense_categories(school)
    ensure_school_cash_accounts(school)

    method = (payment_method or getattr(payroll, "payment_method", None) or "BANK").upper()
    if method in ("BANK_TRANSFER", "TRANSFER"):
        method = "BANK"
    if method in ("M-PESA", "MOBILE"):
        method = "MPESA"

    asset = paid_from_account or getattr(payroll, "paid_from_account", None)
    if not asset:
        asset = asset_account_for_payment_method(school, method)
    if not asset:
        raise ValueError("No cash/bank account configured for payroll payment")

    exp_gl = _account(school, "5100") or _account(school, "5000")
    if not exp_gl:
        raise ValueError("Staff salaries GL account (5100) missing")

    cat = getattr(payroll, "expense_category", None)
    if cat is None:
        cat = ExpenseCategory.objects.filter(school=school, name__icontains="salar").first()
    fee_cat = getattr(payroll, "related_fee_category", None)
    u = staff.user
    name = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip() or u.email
    month_label = payroll.month.strftime("%b %Y") if payroll.month else ""
    title = f"Salary — {name} — {month_label}".strip(" —")

    expense = getattr(payroll, "expense", None)
    if expense is None:
        expense = Expense.objects.create(
            school=school,
            category=cat,
            related_fee_category=fee_cat,
            paid_from_account=asset,
            title=title[:200],
            description=(
                f"Payroll net pay. Basic {payroll.basic_salary}, "
                f"allowances {payroll.allowances}, deductions {payroll.deductions}."
                + (f" Funded from fee group: {fee_cat.name}." if fee_cat else "")
            ),
            amount=amount,
            expense_date=payroll.paid_at or timezone.now().date(),
            payment_method=method if method in dict(Expense.PaymentMethod.choices) else Expense.PaymentMethod.BANK,
            reference_number=f"PAY-{str(payroll.pk)[:8].upper()}",
            paid_to=name[:200],
            created_by=user if user and getattr(user, "is_authenticated", False) else None,
        )
        payroll.expense = expense
        payroll.paid_from_account = asset
        payroll.payment_method = method
        payroll.save(update_fields=["expense", "paid_from_account", "payment_method", "updated_at"])
    elif fee_cat and not expense.related_fee_category_id:
        expense.related_fee_category = fee_cat
        if cat and not expense.category_id:
            expense.category = cat
        expense.save(update_fields=["related_fee_category", "category"])

    # Prefer dedicated payroll source so we don't double-post as generic expense
    if not _already_posted("payroll", payroll.pk):
        post_journal(
            school,
            expense.expense_date,
            f"Payroll: {title}",
            [
                {"account": exp_gl, "debit": amount, "credit": 0},
                {
                    "account": asset,
                    "debit": 0,
                    "credit": amount,
                    "reference": expense.reference_number or "",
                },
            ],
            source_type="payroll",
            source_id=payroll.pk,
        )
    # Also skip re-posting the expense-level journal if something else posts expenses
    return True


@transaction.atomic
def post_internal_transfer(
    school,
    *,
    from_account,
    to_account,
    amount,
    entry_date=None,
    memo: str = "",
    reference: str = "",
    user=None,
):
    """
    Move money between cash pots (evening reconciliation):
      Cr from_account (outflow) · Dr to_account (inflow)
    """
    from apps.finance.models import Account
    from apps.finance.seed_defaults import ensure_school_cash_accounts

    ensure_school_cash_accounts(school)
    amt = _d(amount)
    if amt <= 0:
        raise ValueError("Transfer amount must be greater than zero")
    if not from_account or not to_account:
        raise ValueError("Both source and destination accounts are required")
    if str(from_account.pk) == str(to_account.pk):
        raise ValueError("Source and destination must be different accounts")
    if from_account.school_id != school.id or to_account.school_id != school.id:
        raise ValueError("Accounts must belong to the selected school")
    if from_account.account_type != Account.AccountType.ASSET:
        raise ValueError("Source must be a cash/bank asset account")
    if to_account.account_type != Account.AccountType.ASSET:
        raise ValueError("Destination must be a cash/bank asset account")

    when = entry_date or timezone.now().date()
    note = (memo or f"Transfer {from_account.code} → {to_account.code}").strip()[:255]
    # Unique-ish source id so re-posts with same payload don't double (timestamp+accounts+amount)
    import uuid
    sid = str(uuid.uuid4())

    entry = post_journal(
        school,
        when,
        note,
        [
            {
                "account": to_account,
                "debit": amt,
                "credit": 0,
                "memo": note,
                "reference": reference or "",
            },
            {
                "account": from_account,
                "debit": 0,
                "credit": amt,
                "memo": note,
                "reference": reference or "",
            },
        ],
        source_type="transfer",
        source_id=sid,
    )
    return entry

