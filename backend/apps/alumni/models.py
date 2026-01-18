from django.db import models
from apps.school.models import School


class Alumnus(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='alumnus_profile')
    student = models.OneToOneField('students.Student', on_delete=models.SET_NULL, null=True, blank=True, related_name='alumni_record')  # Link if former student
    full_name = models.CharField(max_length=150)
    graduation_year = models.PositiveIntegerField()
    current_occupation = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class Donation(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='donations')
    alumnus = models.ForeignKey(Alumnus, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    donation_date = models.DateField(auto_now_add=True)
    purpose = models.CharField(max_length=255, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)  # e.g. M-Pesa, Bank

    def __str__(self):
        return f"KSh {self.amount} - {self.alumnus or 'Anonymous'}"


class EventAttendance(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='alumni_event_attendance')
    alumnus = models.ForeignKey(Alumnus, on_delete=models.CASCADE)
    event = models.ForeignKey('events.Event', on_delete=models.CASCADE)
    attended_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.alumnus} at {self.event}"