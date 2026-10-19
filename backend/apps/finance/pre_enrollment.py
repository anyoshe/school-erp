"""Post interview/admission collections into finance income accounts."""
from decimal import Decimal
from django.db import transaction


DEFAULT_ACCOUNTS = [
    ("1000", "Cash / Bank", "ASSET"),
    ("4000", "Interview fee income", "INCOME"),
    ("4010", "Admission fee income", "INCOME"),
    ("4100", "School fee income", "INCOME"),
]


def ensure_default_accounts(school):
    from .models import Account
    for code, name, atype in DEFAULT_ACCOUNTS:
        Account.objects.get_or_create(
            school=school,
            code=code,
            defaults={"name": name, "account_type": atype, "is_active": True},
        )


@transaction.atomic
def post_charge_to_finance(charge, student=None):
    """
    When an ApplicationCharge has amount_paid > 0 and Full/Discounted,
    create/update an IncomeReceipt linked to the correct income account.
    """
    from .models import Account, IncomeReceipt
    from apps.admissions.models import ApplicationCharge

    if not charge or not getattr(charge, "amount_paid", None):
        return None
    amount = Decimal(str(charge.amount_paid or 0))
    if amount <= 0:
        return None
    if charge.policy not in (
        ApplicationCharge.Policy.FULL,
        ApplicationCharge.Policy.DISCOUNTED,
    ):
        return None

    school = charge.application.school
    ensure_default_accounts(school)
    code = "4000" if charge.charge_type == ApplicationCharge.ChargeType.INTERVIEW else "4010"
    account = Account.objects.filter(school=school, code=code).first()
    source = (
        IncomeReceipt.Source.INTERVIEW
        if charge.charge_type == ApplicationCharge.ChargeType.INTERVIEW
        else IncomeReceipt.Source.ADMISSION
    )

    receipt, created = IncomeReceipt.objects.update_or_create(
        charge_id=charge.id,
        defaults={
            "school": school,
            "account": account,
            "application_id": charge.application_id,
            "student": student or getattr(charge.application, "student", None),
            "source": source,
            "amount": amount,
            "payment_method": "CASH",
            "reference_number": "",
            "notes": f"{source} collected on application {charge.application_id}",
        },
    )
    return receipt
