from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0006_term_is_locked"),
        ("staff", "0007_staff_standing_pay_defaults"),
    ]

    operations = [
        migrations.CreateModel(
            name="Period",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=40)),
                ("order", models.PositiveIntegerField(default=1)),
                ("start_time", models.TimeField(blank=True, null=True)),
                ("end_time", models.TimeField(blank=True, null=True)),
                ("is_break", models.BooleanField(default=False)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="timetable_periods", to="school.school")),
            ],
            options={"ordering": ["order", "id"], "unique_together": {("school", "name")}},
        ),
        migrations.CreateModel(
            name="TimetableEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("weekday", models.PositiveSmallIntegerField(choices=[(1, "Monday"), (2, "Tuesday"), (3, "Wednesday"), (4, "Thursday"), (5, "Friday"), (6, "Saturday")])),
                ("room", models.CharField(blank=True, default="", max_length=60)),
                ("notes", models.CharField(blank=True, default="", max_length=200)),
                ("academic_year", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="timetable_entries", to="academics.academicyear")),
                ("period", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="academics.period")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="timetable_entries", to="school.school")),
                ("section", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="timetable_entries", to="academics.section")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="timetable_entries", to="academics.subject")),
                ("teacher", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="timetable_entries", to="staff.staff")),
                ("term", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="timetable_entries", to="academics.term")),
            ],
            options={
                "ordering": ["weekday", "period__order"],
                "unique_together": {("section", "weekday", "period", "academic_year")},
            },
        ),
        migrations.AddIndex(
            model_name="timetableentry",
            index=models.Index(fields=["school", "section"], name="academics_t_school__idx1"),
        ),
        migrations.AddIndex(
            model_name="timetableentry",
            index=models.Index(fields=["school", "weekday"], name="academics_t_school__idx2"),
        ),
    ]
