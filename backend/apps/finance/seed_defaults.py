"""
Default expense categories and cash accounts for every school.
"""
from __future__ import annotations

DEFAULT_EXPENSE_CATEGORIES = [
    ("Staff salaries & wages", "Teaching and non-teaching payroll"),
    ("NSSF / NHIF / statutory", "Statutory deductions paid by the school"),
    ("Casual labour", "Temporary workers, cleaners day-rate"),
    ("Utilities – electricity", "Power bills"),
    ("Utilities – water", "Water bills"),
    ("Internet & airtime", "Connectivity and school phones"),
    ("Rent / lease", "Premises rent if applicable"),
    ("Teaching materials", "Chalk, markers, charts, lab consumables"),
    ("Stationery & office", "Paper, printing, admin supplies"),
    ("Student meals / kitchen", "Food supplies and kitchen gas"),
    ("Transport & fuel", "School van fuel, maintenance, hire"),
    ("Repairs & maintenance", "Buildings, furniture, plumbing"),
    ("Security", "Guards, alarm, CCTV"),
    ("Cleaning & sanitation", "Detergents, hygiene supplies"),
    ("Sports & co-curricular", "Games equipment, trips contribution"),
    ("Exams & assessments", "Exam papers, invigilation costs"),
    ("ICT & software", "Devices, licences, repairs"),
    ("Marketing & outreach", "Admissions marketing, open day"),
    ("Professional fees", "Legal, audit, consultancy"),
    ("Bank charges", "Ledger fees, transfer costs"),
    ("Insurance", "Premises, liability, vehicle"),
    ("Miscellaneous", "Other operating costs"),
]

DEFAULT_ASSET_ACCOUNTS = [
    ("1000", "Cash on hand"),
    ("1010", "Bank account"),
    ("1020", "M-Pesa / mobile money"),
]

DEFAULT_INCOME_ACCOUNTS = [
    ("4000", "School fee income"),
    ("4010", "Admission / registration income"),
    ("4020", "Interview / assessment income"),
    ("4090", "Other income"),
]

DEFAULT_EXPENSE_GL_ACCOUNTS = [
    ("5000", "Operating expenses"),
    ("5100", "Staff salaries"),
]


def ensure_school_expense_categories(school):
    from apps.finance.models import ExpenseCategory
    created = 0
    for name, desc in DEFAULT_EXPENSE_CATEGORIES:
        _, was = ExpenseCategory.objects.get_or_create(
            school=school,
            name=name,
            defaults={"description": desc, "is_active": True},
        )
        if was:
            created += 1
    return created


def ensure_school_cash_accounts(school):
    from apps.finance.models import Account
    created = 0
    specs = (
        [(c, n, Account.AccountType.ASSET) for c, n in DEFAULT_ASSET_ACCOUNTS]
        + [(c, n, Account.AccountType.INCOME) for c, n in DEFAULT_INCOME_ACCOUNTS]
        + [(c, n, Account.AccountType.EXPENSE) for c, n in DEFAULT_EXPENSE_GL_ACCOUNTS]
    )
    for code, name, atype in specs:
        _, was = Account.objects.get_or_create(
            school=school,
            code=code,
            defaults={
                "name": name,
                "account_type": atype,
                "is_active": True,
            },
        )
        if was:
            created += 1
    return created


def ensure_school_finance_defaults(school):
    """Seed expense categories + chart of accounts (cash + income + expense)."""
    from apps.finance.lunch import ensure_meals_fee_defaults
    meals = ensure_meals_fee_defaults(school)
    return {
        "categories": ensure_school_expense_categories(school),
        "accounts": ensure_school_cash_accounts(school),
        "meals": meals,
    }


def asset_account_for_payment_method(school, payment_method: str):
    """Map CASH / BANK / MPESA → asset Account row."""
    from apps.finance.models import Account
    ensure_school_cash_accounts(school)
    raw = (payment_method or "CASH").upper()
    method = raw.replace(" ", "").replace("_", "").replace("-", "")
    if "MPESA" in method or "MOBILE" in method:
        code = "1020"
    elif method in ("BANK", "BANKTRANSFER", "CHEQUE", "CHECK", "EFT", "RTGS") or "BANK" in method:
        code = "1010"
    else:
        # CASH and unknown → cash on hand
        code = "1000"
    acc = Account.objects.filter(school=school, code=code).first()
    if not acc:
        acc = Account.objects.filter(school=school, account_type=Account.AccountType.ASSET).first()
    return acc
