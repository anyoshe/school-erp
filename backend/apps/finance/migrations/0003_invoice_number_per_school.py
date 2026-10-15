from django.db import migrations, models


def backfill_invoice_school(apps, schema_editor):
    Invoice = apps.get_model("finance", "Invoice")
    for inv in Invoice.objects.select_related("student").all().iterator():
        if inv.student_id and inv.school_id != inv.student.school_id:
            inv.school_id = inv.student.school_id
            inv.save(update_fields=["school_id"])


def backfill_payment_school(apps, schema_editor):
    Payment = apps.get_model("finance", "Payment")
    for pay in Payment.objects.select_related("invoice", "invoice__student").all().iterator():
        school_id = pay.invoice.school_id if pay.invoice_id else None
        if not school_id and pay.invoice_id and pay.invoice.student_id:
            school_id = pay.invoice.student.school_id
        if school_id and pay.school_id != school_id:
            pay.school_id = school_id
            pay.save(update_fields=["school_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0002_initial"),
        ("school", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill_invoice_school, migrations.RunPython.noop),
        migrations.RunPython(backfill_payment_school, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="invoice",
            name="invoice_number",
            field=models.CharField(max_length=50),
        ),
        migrations.AddConstraint(
            model_name="invoice",
            constraint=models.UniqueConstraint(
                fields=("school", "invoice_number"),
                name="finance_invoice_unique_number_per_school",
            ),
        ),
    ]
