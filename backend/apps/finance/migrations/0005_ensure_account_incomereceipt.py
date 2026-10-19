from django.db import migrations, models, connection
import django.db.models.deletion
import uuid


def ensure_tables(apps, schema_editor):
    """Create Account / IncomeReceipt tables if 0004 was faked without DDL."""
    with connection.cursor() as cursor:
        vendor = connection.vendor
        if vendor == "postgresql":
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS finance_account (
                    id uuid PRIMARY KEY,
                    code varchar(20) NOT NULL,
                    name varchar(120) NOT NULL,
                    account_type varchar(20) NOT NULL,
                    is_active boolean NOT NULL DEFAULT true,
                    school_id uuid NOT NULL REFERENCES school_school(id) DEFERRABLE INITIALLY DEFERRED
                );
                """
            )
            cursor.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS finance_account_school_code_uniq
                ON finance_account (school_id, code);
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS finance_incomereceipt (
                    id uuid PRIMARY KEY,
                    application_id uuid NULL,
                    source varchar(20) NOT NULL,
                    amount numeric(12, 2) NOT NULL,
                    payment_method varchar(50) NOT NULL DEFAULT '',
                    reference_number varchar(100) NOT NULL DEFAULT '',
                    notes text NOT NULL DEFAULT '',
                    paid_at timestamptz NOT NULL DEFAULT NOW(),
                    charge_id uuid NULL,
                    account_id uuid NULL REFERENCES finance_account(id) DEFERRABLE INITIALLY DEFERRED,
                    school_id uuid NOT NULL REFERENCES school_school(id) DEFERRABLE INITIALLY DEFERRED,
                    student_id uuid NULL
                );
                """
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS finance_incomereceipt_application_id_idx ON finance_incomereceipt (application_id);"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS finance_incomereceipt_charge_id_idx ON finance_incomereceipt (charge_id);"
            )
        else:
            # SQLite / others: best-effort
            pass


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0004_account_incomereceipt"),
        ("school", "0004_pre_enrollment_fee_settings"),
        ("students", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(ensure_tables, noop),
    ]
