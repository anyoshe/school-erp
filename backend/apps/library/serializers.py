from rest_framework import serializers
from .models import (
    Book, BookCopy, Borrowing, Acquisition, AcquisitionLine, Reservation,
    ClassAllocation, ClassAllocationItem, Stocktake, StocktakeItem,
    LibrarySettings, DigitalResource, ResourceAssignment, ReadingProgress, Bookmark,
)


class BookSerializer(serializers.ModelSerializer):
    copies_total = serializers.SerializerMethodField()
    copies_available = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id", "school", "title", "subtitle", "author", "publisher", "isbn", "edition",
            "publication_year", "language", "description", "cover", "subject", "learning_area",
            "topic", "grade_levels", "curriculum", "category", "quantity", "is_active",
            "copies_total", "copies_available", "created_at", "updated_at",
        ]
        read_only_fields = ["school", "quantity"]

    def get_copies_total(self, obj):
        v = getattr(obj, "_copies_total", None)
        return obj.copies.count() if v is None else v

    def get_copies_available(self, obj):
        v = getattr(obj, "_copies_available", None)
        if v is not None:
            return v
        return obj.copies.filter(status="AVAILABLE").count()


class BookCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = [
            "id", "title", "subtitle", "author", "publisher", "isbn", "edition",
            "publication_year", "language", "description", "cover", "subject", "learning_area",
            "topic", "grade_levels", "curriculum", "category", "is_active",
        ]


class BookCopySerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source="book.title", read_only=True)

    class Meta:
        model = BookCopy
        fields = [
            "id", "school", "book", "book_title", "accession_number", "barcode",
            "acquisition_date", "purchase_price", "storage_location", "condition",
            "status", "acquisition_source", "remarks", "created_at",
        ]
        read_only_fields = ["school"]


class BorrowingSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source="book.title", read_only=True)
    accession_number = serializers.CharField(source="copy.accession_number", read_only=True, default=None)
    student_name = serializers.SerializerMethodField()
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = Borrowing
        fields = [
            "id", "school", "book", "book_title", "copy", "accession_number",
            "user", "student", "student_name", "staff", "staff_name", "borrower_type",
            "borrow_date", "due_date", "return_date", "status", "return_condition",
            "academic_year", "term", "remarks", "created_at",
        ]
        read_only_fields = ["school", "status"]

    def get_student_name(self, obj):
        if not obj.student_id:
            return None
        s = obj.student
        return f"{getattr(s, 'first_name', '')} {getattr(s, 'last_name', '')}".strip()

    def get_staff_name(self, obj):
        if not obj.staff_id:
            return None
        s = obj.staff
        return f"{getattr(s, 'first_name', '')} {getattr(s, 'last_name', '')}".strip() or str(s)


class BorrowingCreateUpdateSerializer(serializers.ModelSerializer):
    """Legacy create — prefer /issue/ action."""

    class Meta:
        model = Borrowing
        fields = ["id", "book", "user", "borrow_date", "return_date", "due_date", "remarks"]


class IssueSerializer(serializers.Serializer):
    copy_id = serializers.UUIDField()
    student_id = serializers.UUIDField(required=False, allow_null=True)
    staff_id = serializers.UUIDField(required=False, allow_null=True)
    borrow_date = serializers.DateField(required=False)
    due_date = serializers.DateField(required=False)
    academic_year = serializers.CharField(required=False, allow_blank=True)
    term = serializers.CharField(required=False, allow_blank=True)
    remarks = serializers.CharField(required=False, allow_blank=True)


class ReturnSerializer(serializers.Serializer):
    return_date = serializers.DateField(required=False)
    condition = serializers.CharField(required=False, allow_blank=True)
    mark_lost = serializers.BooleanField(required=False, default=False)
    mark_damaged = serializers.BooleanField(required=False, default=False)
    remarks = serializers.CharField(required=False, allow_blank=True)


class RegisterCopiesSerializer(serializers.Serializer):
    book_id = serializers.UUIDField()
    count = serializers.IntegerField(min_value=1, max_value=500)
    accession_prefix = serializers.CharField(required=False, allow_blank=True)
    start_number = serializers.IntegerField(required=False)
    storage_location = serializers.CharField(required=False, allow_blank=True)
    acquisition_source = serializers.CharField(required=False, allow_blank=True)
    acquisition_date = serializers.DateField(required=False)
    purchase_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class AcquisitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Acquisition
        fields = "__all__"
        read_only_fields = ["school", "created_by", "created_at"]


class ReservationSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source="book.title", read_only=True)

    class Meta:
        model = Reservation
        fields = "__all__"
        read_only_fields = ["school", "created_at"]


class ClassAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassAllocation
        fields = "__all__"
        read_only_fields = ["school", "created_by", "created_at"]


class StocktakeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stocktake
        fields = "__all__"
        read_only_fields = ["school", "created_by", "started_at"]


class LibrarySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibrarySettings
        fields = "__all__"
        read_only_fields = ["school", "updated_at"]


class DigitalResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DigitalResource
        fields = "__all__"
        read_only_fields = ["school", "uploaded_by", "approved_by", "created_at", "updated_at", "file_size", "mime_type"]


class ResourceAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceAssignment
        fields = "__all__"
        read_only_fields = ["school", "assigned_by", "assigned_at"]


class ReadingProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingProgress
        fields = "__all__"
        read_only_fields = ["school", "user", "last_accessed"]


class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = "__all__"
        read_only_fields = ["school", "user", "created_at"]
