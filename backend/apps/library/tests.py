from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.school.models import School
from apps.library.models import Book, BookCopy, Borrowing
from apps.library import services
from datetime import date


class LibraryIssueReturnTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(email="lib@test.com", password="pass12345")
        self.school = School.objects.create(name="Test School", owner=self.user)
        self.book = Book.objects.create(school=self.school, title="Math Grade 4", author="KICD")

    def test_register_and_issue_prevents_double(self):
        copies = services.register_copies(school=self.school, book=self.book, count=1, accession_prefix="T")
        self.assertEqual(len(copies), 1)
        c = copies[0]
        loan = services.issue_copy(school=self.school, copy=c, user=self.user, issued_by=self.user)
        self.assertEqual(loan.status, Borrowing.Status.ACTIVE)
        c.refresh_from_db()
        self.assertEqual(c.status, BookCopy.Status.ISSUED)
        with self.assertRaises(Exception):
            services.issue_copy(school=self.school, copy=c, user=self.user, issued_by=self.user)
        services.return_loan(loan=loan)
        c.refresh_from_db()
        self.assertEqual(c.status, BookCopy.Status.AVAILABLE)
