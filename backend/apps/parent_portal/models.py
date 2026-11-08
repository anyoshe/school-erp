from django.db import models
from django.contrib.auth import get_user_model
from apps.school.models import School

User = get_user_model()


class GuardianProfile(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="parent_guardian_profiles")
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="guardian_profile")
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    relationship = models.CharField(
        max_length=50,
        choices=[("parent", "Parent"), ("guardian", "Guardian")],
        default="parent",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name


class ParentStudentLink(models.Model):
    """Links a portal parent account to one or more learners at a school."""

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="parent_student_links")
    guardian_profile = models.ForeignKey(
        GuardianProfile, on_delete=models.CASCADE, related_name="student_links"
    )
    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="parent_links"
    )
    is_primary = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("guardian_profile", "student")

    def __str__(self):
        return f"{self.guardian_profile_id} → {self.student_id}"


class Message(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="sent_messages")
    receiver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="received_messages")
    subject = models.CharField(max_length=255)
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.subject


class Notification(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="notifications")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=150)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
