from django.db import migrations, models


def _column_exists(cursor, table, column):
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
        """,
        [table, column],
    )
    return cursor.fetchone() is not None


def add_pre_enrollment_fee_columns(apps, schema_editor):
    """Idempotent: columns may already exist on some DBs."""
    table = "school_school"
    fields = {
        "admission_fee_amount": (
            "ALTER TABLE school_school "
            "ADD COLUMN admission_fee_amount numeric(12, 2) DEFAULT 0 NOT NULL"
        ),
        "interview_fee_amount": (
            "ALTER TABLE school_school "
            "ADD COLUMN interview_fee_amount numeric(12, 2) DEFAULT 0 NOT NULL"
        ),
        "interview_fee_enabled": (
            "ALTER TABLE school_school "
            "ADD COLUMN interview_fee_enabled boolean DEFAULT false NOT NULL"
        ),
        "require_admission_fee_before_enroll": (
            "ALTER TABLE school_school "
            "ADD COLUMN require_admission_fee_before_enroll boolean DEFAULT false NOT NULL"
        ),
    }
    with schema_editor.connection.cursor() as cursor:
        for column, sql in fields.items():
            if not _column_exists(cursor, table, column):
                cursor.execute(sql)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("school", "0003_schoolsupportsession_one_active_school_support_per_admin"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="school",
                    name="admission_fee_amount",
                    field=models.DecimalField(
                        decimal_places=2,
                        default=0,
                        help_text="One-time admission/registration fee (0 = treat as N/A by default)",
                        max_digits=12,
                    ),
                ),
                migrations.AddField(
                    model_name="school",
                    name="interview_fee_amount",
                    field=models.DecimalField(
                        decimal_places=2, default=0, max_digits=12
                    ),
                ),
                migrations.AddField(
                    model_name="school",
                    name="interview_fee_enabled",
                    field=models.BooleanField(
                        default=False,
                        help_text="If true, interview fee applies unless marked N/A on the application",
                    ),
                ),
                migrations.AddField(
                    model_name="school",
                    name="require_admission_fee_before_enroll",
                    field=models.BooleanField(
                        default=False,
                        help_text="If true, enroll is blocked until admission charge is satisfied",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(add_pre_enrollment_fee_columns, noop_reverse),
            ],
        ),
    ]
