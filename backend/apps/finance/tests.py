from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from .clearance import find_fee_structure
from .serializers import InvoiceDetailSerializer


class RelatedList(list):
    def all(self):
        return self


class FindFeeStructureTests(SimpleTestCase):
    def setUp(self):
        self.grade = SimpleNamespace(id=10)
        self.student = SimpleNamespace(
            school_id=1,
            current_class=self.grade,
        )

    def make_structure(self, *, grade_id=10, year="2026", term="Term 3", active=True):
        return SimpleNamespace(
            id=f"{grade_id}-{year}-{term}",
            school_id=1,
            grade_level_id=grade_id,
            academic_year=year,
            period_name=term,
            is_active=active,
        )

    def resolve(self, structures, year="2026", term="Term 3"):
        queryset = Mock()
        queryset.prefetch_related.return_value = structures
        with patch("apps.finance.models.FeeStructure.objects.filter", return_value=queryset):
            return find_fee_structure(
                self.student,
                academic_year=year,
                period_name=term,
            )

    def test_selects_only_the_exact_grade_year_and_term(self):
        wrong_year = self.make_structure(year="2027", term="Term 1")
        wrong_term = self.make_structure(term="Term 1")
        expected = self.make_structure()

        self.assertIs(self.resolve([wrong_year, wrong_term, expected]), expected)

    def test_does_not_fall_back_to_another_period_grade_or_inactive_structure(self):
        alternatives = [
            self.make_structure(year="2027", term="Term 1"),
            self.make_structure(term="Term 1"),
            self.make_structure(grade_id=11),
            self.make_structure(active=False),
        ]

        self.assertIsNone(self.resolve(alternatives))

    def test_requires_an_explicit_year_and_term(self):
        self.assertIsNone(self.resolve([self.make_structure()], year="", term=""))


class InvoiceDetailSerializerTests(SimpleTestCase):
    def test_includes_prior_allocations_and_remaining_per_fee_line(self):
        payment = SimpleNamespace(
            id="payment-1",
            amount=40,
            payment_method="CASH",
            reference_number="",
            receipt_number="R-1",
            paid_at=None,
            payment_date=None,
            line_allocations=[
                {"line_id": "line-1", "description": "Tuition", "amount": 25},
                {"line_id": "line-2", "description": "Transport", "amount": 15},
            ],
        )
        unallocated_payment = SimpleNamespace(
            id="payment-2",
            amount=20,
            payment_method="BANK",
            reference_number="",
            receipt_number="",
            paid_at=None,
            payment_date=None,
            line_allocations=[],
        )
        invoice = SimpleNamespace(
            amount_paid=60,
            lines=RelatedList([
                SimpleNamespace(id="line-1", amount=100, description="Tuition"),
                SimpleNamespace(id="line-2", amount=50, description="Transport"),
            ]),
            payments=RelatedList([payment, unallocated_payment]),
        )
        serializer = InvoiceDetailSerializer()

        lines = serializer.get_lines(invoice)

        self.assertEqual(lines[0]["paid_amount"], 25)
        self.assertEqual(lines[0]["remaining_balance"], 75)
        self.assertEqual(lines[1]["paid_amount"], 15)
        self.assertEqual(lines[1]["remaining_balance"], 35)
        self.assertEqual(serializer.get_unallocated_paid(invoice), 20)
        self.assertEqual(serializer.get_payments(invoice)[0]["line_allocations"], payment.line_allocations)

    def test_counts_payments_without_saved_allocations_as_unallocated(self):
        invoice = SimpleNamespace(
            amount_paid=30,
            lines=RelatedList([
                SimpleNamespace(id="line-1", amount=100, description="Tuition"),
            ]),
            payments=RelatedList([
                SimpleNamespace(line_allocations=[]),
            ]),
        )

        self.assertEqual(InvoiceDetailSerializer().get_unallocated_paid(invoice), 30)
