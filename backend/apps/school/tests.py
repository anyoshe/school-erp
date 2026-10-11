from datetime import date
from decimal import Decimal
from django.urls import reverse
from rest_framework.test import APIRequestFactory, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.finance.models import Invoice, StudentFeeAssignment
from apps.finance.serializers import PaymentCreateUpdateSerializer
from apps.students.models import Guardian, Student, StudentGuardian
from apps.students.serializers import LinkExistingGuardianSerializer
from .models import School, SchoolSupportAuditLog


class PlatformSchoolSupportTests(APITestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            email="platform@example.test",
            password="safe-test-password",
        )
        self.member = User.objects.create_user(
            email="member@example.test",
            password="safe-test-password",
            role=User.Role.SCHOOL_ADMIN,
        )
        self.school_one = School.objects.create(name="North School")
        self.school_two = School.objects.create(name="South School")
        self.unrelated_school = School.objects.create(name="East School")
        self.school_one.users.add(self.member)
        self.school_two.users.add(self.member)

    def authenticate(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")

    def test_superuser_can_open_platform_directory_without_a_school(self):
        self.authenticate(self.superuser)

        response = self.client.get(reverse("schools-platform-directory"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual({school["id"] for school in response.data}, {
            str(self.school_one.id),
            str(self.school_two.id),
            str(self.unrelated_school.id),
        })
        self.assertFalse(self.superuser.schools.exists())

    def test_superuser_must_start_support_context_before_school_access(self):
        Student.objects.create(
            school=self.school_one,
            first_name="North",
            last_name="Student",
            admission_number="N-1",
        )
        Student.objects.create(
            school=self.school_two,
            first_name="South",
            last_name="Student",
            admission_number="S-1",
        )
        self.authenticate(self.superuser)

        without_context = self.client.get("/api/students/")
        self.assertEqual(without_context.status_code, 200)
        self.assertEqual(without_context.data, [])

        started = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": str(self.school_one.id), "reason": "Investigating a support ticket"},
            format="json",
        )
        self.assertEqual(started.status_code, 201)
        session_id = started.data["id"]
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.superuser)}",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
            HTTP_X_SCHOOL_SUPPORT_ID=session_id,
        )

        visible_students = self.client.get("/api/students/")
        self.assertEqual(visible_students.status_code, 200)
        self.assertEqual(len(visible_students.data), 1)
        self.assertEqual(visible_students.data[0]["first_name"], "North")
        self.assertTrue(
            SchoolSupportAuditLog.objects.filter(
                administrator=self.superuser,
                school=self.school_one,
                action="get:students",
            ).exists()
        )

    def test_support_context_can_switch_schools_and_invalidates_previous_context(self):
        self.authenticate(self.superuser)
        first = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": str(self.school_one.id), "reason": "First support request"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.superuser)}",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
            HTTP_X_SCHOOL_SUPPORT_ID=first.data["id"],
        )
        second = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": str(self.school_two.id), "reason": "Second support request"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201, second.data)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.superuser)}",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
            HTTP_X_SCHOOL_SUPPORT_ID=first.data["id"],
        )
        stale_context = self.client.get(f"/api/schools/{self.school_one.id}/")
        self.assertEqual(stale_context.status_code, 403)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.superuser)}",
            HTTP_X_SCHOOL_ID=str(self.school_two.id),
            HTTP_X_SCHOOL_SUPPORT_ID=second.data["id"],
        )
        active_context = self.client.get(f"/api/schools/{self.school_two.id}/")
        self.assertEqual(active_context.status_code, 200)

    def test_regular_user_cannot_select_another_school(self):
        self.authenticate(self.member)

        first_school = self.client.get(
            "/api/students/",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
        )
        second_school = self.client.get(
            "/api/students/",
            HTTP_X_SCHOOL_ID=str(self.school_two.id),
        )
        self.assertEqual(first_school.status_code, 200)
        self.assertEqual(second_school.status_code, 200)

        cross_school = self.client.get(
            "/api/students/",
            HTTP_X_SCHOOL_ID=str(self.unrelated_school.id),
        )
        invalid_id = self.client.get(
            "/api/students/",
            HTTP_X_SCHOOL_ID="not-a-uuid",
        )
        self.assertEqual(cross_school.status_code, 403)
        self.assertEqual(invalid_id.status_code, 400)

    def test_cross_school_guardian_cannot_be_linked_to_student(self):
        student = Student.objects.create(
            school=self.school_one,
            first_name="North",
            last_name="Student",
            admission_number="N-2",
        )
        guardian = Guardian.objects.create(
            school=self.school_two,
            full_name="South Guardian",
            phone="555-0102",
        )
        request = APIRequestFactory().post(
            "/api/students/guardians/link-existing/",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
        )
        request.user = self.member

        serializer = LinkExistingGuardianSerializer(
            data={"student": str(student.id), "guardian": str(guardian.id)},
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("guardian", serializer.errors)

    def test_payment_payer_must_belong_to_invoice_student_and_school(self):
        student = Student.objects.create(
            school=self.school_one,
            first_name="North",
            last_name="Student",
            admission_number="N-3",
        )
        other_student = Student.objects.create(
            school=self.school_two,
            first_name="South",
            last_name="Student",
            admission_number="S-2",
        )
        guardian = Guardian.objects.create(
            school=self.school_two,
            full_name="South Guardian",
            phone="555-0103",
        )
        payer = StudentGuardian.objects.create(
            student=other_student,
            guardian=guardian,
        )
        assignment = StudentFeeAssignment.objects.create(student=student)
        invoice = Invoice.objects.create(
            school=self.school_one,
            student=student,
            fee_assignment=assignment,
            due_date=date.today(),
            term="Term 1",
            academic_year="2026",
            invoice_number="N-INV-1",
            amount_due=Decimal("100.00"),
        )
        request = APIRequestFactory().post(
            "/api/finance/payments/",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
        )
        request.user = self.member

        serializer = PaymentCreateUpdateSerializer(
            data={
                "school": str(self.school_one.id),
                "invoice": str(invoice.id),
                "amount": "10.00",
                "paid_by": str(payer.id),
            },
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("paid_by", serializer.errors)

    def test_missing_support_reason_and_unknown_school_are_rejected(self):
        self.authenticate(self.superuser)

        missing_reason = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": str(self.school_one.id)},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, 400)

        malformed_school = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": "not-a-uuid", "reason": "Test"},
            format="json",
        )
        self.assertEqual(malformed_school.status_code, 400)

        unknown_school = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": "00000000-0000-0000-0000-000000000001", "reason": "Test"},
            format="json",
        )
        self.assertEqual(unknown_school.status_code, 404)

    def test_super_admin_role_without_django_superuser_permission_is_denied(self):
        role_only = User.objects.create_user(
            email="role-only@example.test",
            password="safe-test-password",
            role=User.Role.SUPER_ADMIN,
        )
        self.authenticate(role_only)

        response = self.client.get(reverse("schools-platform-directory"))

        self.assertEqual(response.status_code, 403)

    def test_support_context_is_read_only(self):
        self.authenticate(self.superuser)
        started = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": str(self.school_one.id), "reason": "Read-only test"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.superuser)}",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
            HTTP_X_SCHOOL_SUPPORT_ID=started.data["id"],
        )

        response = self.client.delete(f"/api/schools/{self.school_one.id}/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(School.objects.filter(pk=self.school_one.pk).exists())

    def test_support_context_can_be_ended(self):
        self.authenticate(self.superuser)
        started = self.client.post(
            reverse("schools-start-support-context"),
            {"school_id": str(self.school_one.id), "reason": "Exit test"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.superuser)}",
            HTTP_X_SCHOOL_ID=str(self.school_one.id),
            HTTP_X_SCHOOL_SUPPORT_ID=started.data["id"],
        )

        ended = self.client.post(reverse("schools-end-support-context"))

        self.assertEqual(ended.status_code, 200)
        self.assertTrue(
            SchoolSupportAuditLog.objects.filter(
                administrator=self.superuser,
                school=self.school_one,
                action="context_ended",
            ).exists()
        )
