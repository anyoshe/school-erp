from django.test import TestCase

from apps.finance.models import ExpenseCategory, FeeCategory
from apps.school.models import School
from .serializers import StaffWriteSerializer


class StaffWriteSerializerCategoryTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name="Test school")
        self.other_school = School.objects.create(name="Other school")
        self.fee_category = FeeCategory.objects.create(
            school=self.school, name="Tuition"
        )
        self.expense_category = ExpenseCategory.objects.create(
            school=self.school, name="Staff salaries"
        )
        self.other_fee_category = FeeCategory.objects.create(
            school=self.other_school, name="Other tuition"
        )

    def test_accepts_fee_integer_and_expense_uuid_primary_keys(self):
        serializer = StaffWriteSerializer(
            data={
                "default_fee_category": self.fee_category.pk,
                "default_expense_category": str(self.expense_category.pk),
            },
            context={"school": self.school},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["default_fee_category"], self.fee_category
        )
        self.assertEqual(
            serializer.validated_data["default_expense_category"],
            self.expense_category,
        )

    def test_rejects_fee_category_from_another_school(self):
        serializer = StaffWriteSerializer(
            data={"default_fee_category": self.other_fee_category.pk},
            context={"school": self.school},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("default_fee_category", serializer.errors)
