# library/models.py
import uuid
from django.db import models
from apps.accounts.models import User
from apps.school.models import School

class Book(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(default=1)
    school = models.ForeignKey(
        School,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="library_books",
    )

class Borrowing(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    borrow_date = models.DateField()
    return_date = models.DateField(null=True, blank=True)
    
    # Phase-4-ready: add school FK here
    # This is where you associate a borrowing record with a school
    # school = models.ForeignKey('core.School', on_delete=models.CASCADE, null=True, blank=True)
