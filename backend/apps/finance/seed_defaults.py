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
    for code, name in DEFAULT_ASSET_ACCOUNTS:
        _, was = Account.objects.get_or_create(
            school=school,
            code=code,
            defaults={
                "name": name,
                "account_type": Account.AccountType.ASSET,
                "is_active": True,
            },
        )
        if was:
            created += 1
    return created


def ensure_school_finance_defaults(school):
    """Seed expense categories + cash/bank/M-Pesa accounts."""
    return {
        "categories": ensure_school_expense_categories(school),
        "accounts": ensure_school_cash_accounts(school),
    }
