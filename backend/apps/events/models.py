from django.db import models
from apps.school.models import School


class Event(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='events')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=50, choices=[('sports', 'Sports'), ('academic', 'Academic'), ('cultural', 'Cultural'), ('other', 'Other')])
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Participant(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='event_participants')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='participants')
    student = models.ForeignKey('students.Student', on_delete=models.SET_NULL, null=True, blank=True)
    staff = models.ForeignKey('staff.Staff', on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=50, blank=True)  # e.g. Player, Organizer
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student or self.staff} - {self.event}"


class Budget(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='event_budgets')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='budget')
    item = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    actual_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.item} - {self.event}"