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


class StocktakeIssuedNotMissingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="st@test.com", password="pass12345", role="LIBRARIAN")
        self.school = School.objects.create(name="ST School", owner=self.user)
        self.school.users.add(self.user)
        self.book = Book.objects.create(school=self.school, title="Hist G5", author="X")
        copies = services.register_copies(school=self.school, book=self.book, count=2, accession_prefix="ST")
        self.available = copies[0]
        self.issued = copies[1]
        services.issue_copy(school=self.school, copy=self.issued, user=self.user, issued_by=self.user)

    def test_close_does_not_treat_issued_as_available_missing(self):
        from apps.library.models import Stocktake, StocktakeItem
        st = Stocktake.objects.create(school=self.school, name="Check", created_by=self.user)
        # only scan available one
        StocktakeItem.objects.create(
            stocktake=st, copy=self.available,
            accession_scanned=self.available.accession_number,
            result=StocktakeItem.Result.FOUND,
        )
        client = APIClient()
        client.force_authenticate(user=self.user)
        res = client.post(
            f"/api/library/stocktakes/{st.id}/close/",
            {},
            format="json",
            HTTP_X_SCHOOL_ID=str(self.school.id),
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertGreaterEqual(data["summary"].get("issued_out_not_scanned", 0), 1)
        # issued copy notes
        item = StocktakeItem.objects.filter(stocktake=st, copy=self.issued).first()
        self.assertIsNotNone(item)
        self.assertIn("issued", (item.notes or "").lower())


class AllocationLoanFlagTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="al@test.com", password="pass12345", role="LIBRARIAN")
        self.school = School.objects.create(name="AL School", owner=self.user)
        self.school.users.add(self.user)
        self.book = Book.objects.create(school=self.school, title="Math", author="Y")
        from apps.students.models import Student
        self.student = Student.objects.create(
            school=self.school,
            admission_number="A1",
            first_name="Ann",
            last_name="Bee",
        )

    def test_individual_allocation_sets_flag(self):
        services.register_copies(school=self.school, book=self.book, count=1, accession_prefix="AL")
        alloc, items = services.allocate_class_textbooks(
            school=self.school,
            name="G4 Math",
            grade_label="Grade 4",
            academic_year="2026",
            book=self.book,
            student_ids=[str(self.student.id)],
            individual=True,
            created_by=self.user,
        )
        self.assertEqual(len(items), 1)
        loan = items[0].loan
        self.assertIsNotNone(loan)
        self.assertTrue(loan.is_allocation_loan)


class NotificationIdempotencyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="n@test.com", password="pass12345", role="STUDENT")
        self.school = School.objects.create(name="N School", owner=self.user)
        self.school.users.add(self.user)

    def test_notify_once(self):
        from apps.library.notifications import notify_once
        a = notify_once(self.school, self.user, "k1", "T", "M")
        b = notify_once(self.school, self.user, "k1", "T", "M")
        self.assertIsNotNone(a)
        self.assertIsNone(b)
