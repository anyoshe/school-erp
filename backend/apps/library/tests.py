from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.school.models import School
from apps.library.models import Book, BookCopy, Borrowing, DigitalResource
from apps.library import services


User = get_user_model()


def _make_school_with_users():
    admin = User.objects.create_user(email="admin_lib@test.com", password="pass12345", role="SCHOOL_ADMIN")
    librarian = User.objects.create_user(email="librarian@test.com", password="pass12345", role="LIBRARIAN")
    teacher = User.objects.create_user(email="teacher_lib@test.com", password="pass12345", role="TEACHER")
    student = User.objects.create_user(email="student_lib@test.com", password="pass12345", role="STUDENT")
    school = School.objects.create(name="Lib Test School", owner=admin)
    school.users.add(admin, librarian, teacher, student)
    return school, admin, librarian, teacher, student


class LibrarySecurityTests(TestCase):
    def setUp(self):
        self.school, self.admin, self.librarian, self.teacher, self.student = _make_school_with_users()
        self.other_admin = User.objects.create_user(email="other_admin@test.com", password="pass12345", role="SCHOOL_ADMIN")
        self.other = School.objects.create(name="Other School", owner=self.other_admin)
        self.other.users.add(self.other_admin)
        self.book = Book.objects.create(school=self.school, title="Kiswahili G4", author="KICD")
        self.client = APIClient()

    def auth(self, user, school=None):
        self.client.force_authenticate(user=user)
        sid = str((school or self.school).id)
        return {"HTTP_X_SCHOOL_ID": sid}

    def test_student_cannot_create_book(self):
        h = self.auth(self.student)
        res = self.client.post("/api/library/books/", {"title": "Hack"}, format="json", **h)
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED))

    def test_librarian_can_create_book(self):
        h = self.auth(self.librarian)
        res = self.client.post(
            "/api/library/books/",
            {"title": "Science G4", "author": "KICD", "category": "TEXTBOOK"},
            format="json",
            **h,
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)

    def test_student_cannot_approve_digital(self):
        dig = DigitalResource.objects.create(
            school=self.school, title="Notes", approval_status=DigitalResource.ApprovalStatus.PENDING
        )
        h = self.auth(self.student)
        res = self.client.post(f"/api/library/digital/{dig.id}/approve/", {}, format="json", **h)
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED))

    def test_librarian_can_approve_digital(self):
        dig = DigitalResource.objects.create(
            school=self.school, title="Notes2", approval_status=DigitalResource.ApprovalStatus.PENDING
        )
        h = self.auth(self.librarian)
        res = self.client.post(f"/api/library/digital/{dig.id}/approve/", {}, format="json", **h)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        dig.refresh_from_db()
        self.assertEqual(dig.approval_status, DigitalResource.ApprovalStatus.APPROVED)

    def test_cross_school_book_list_isolated(self):
        Book.objects.create(school=self.other, title="Secret Book", author="X")
        h = self.auth(self.librarian)
        res = self.client.get("/api/library/books/", **h)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        titles = [b.get("title") for b in (res.data if isinstance(res.data, list) else res.data.get("results", []))]
        self.assertIn("Kiswahili G4", titles)
        self.assertNotIn("Secret Book", titles)

    def test_student_cannot_issue(self):
        copies = services.register_copies(school=self.school, book=self.book, count=1, accession_prefix="S")
        h = self.auth(self.student)
        res = self.client.post(
            "/api/library/borrowings/issue/",
            {"copy_id": str(copies[0].id)},
            format="json",
            **h,
        )
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED))


class LibraryIssueReturnTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="lib2@test.com", password="pass12345", role="LIBRARIAN")
        try:
            self.school = School.objects.create(name="Test School 2", owner=self.user)
        except TypeError:
            self.school = School.objects.create(name="Test School 2")
        self.school.users.add(self.user)
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
