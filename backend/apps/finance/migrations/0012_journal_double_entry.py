import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0011_expense_account_mapping"),
    ]

    operations = [
        migrations.AddField(
            model_name="cashledgerentry",
            name="account",
            field=models.ForeignKey(
                blank=True,
                help_text="Asset account affected (Cash / Bank / M-Pesa).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="ledger_entries",
                to="finance.account",
            ),
        ),
        migrations.AlterField(
            model_name="cashledgerentry",
            name="source_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.CreateModel(
            name="JournalEntry",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("entry_date", models.DateField()),
                ("memo", models.CharField(max_length=255)),
                ("source_type", models.CharField(blank=True, db_index=True, max_length=40)),
                ("source_id", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="journal_entries", to="school.school")),
            ],
            options={"ordering": ["-entry_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="JournalLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("debit", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("credit", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("memo", models.CharField(blank=True, max_length=255)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="journal_lines", to="finance.account")),
                ("entry", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="finance.journalentry")),
            ],
            options={"ordering": ["id"]},
        ),
    ]
