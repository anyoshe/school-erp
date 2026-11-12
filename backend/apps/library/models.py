# library/models.py — physical + digital library (extends original Book / Borrowing)
import uuid
from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from apps.school.models import School


class Book(models.Model):
    """Catalogue title (one logical work). Physical copies are BookCopy rows."""

    class Category(models.TextChoices):
        TEXTBOOK = "TEXTBOOK", "Textbook"
        REFERENCE = "REFERENCE", "Reference"
        STORYBOOK = "STORYBOOK", "Storybook"
        DICTIONARY = "DICTIONARY", "Dictionary"
        ENCYCLOPEDIA = "ENCYCLOPEDIA", "Encyclopedia"
        REVISION = "REVISION", "Revision book"
        TEACHER_REF = "TEACHER_REF", "Teacher reference"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School, null=True, blank=True, on_delete=models.CASCADE, related_name="library_books"
    )
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=200, blank=True, default="")
    author = models.CharField(max_length=200, blank=True, default="")
    publisher = models.CharField(max_length=200, blank=True, default="")
    isbn = models.CharField(max_length=32, blank=True, default="")
    edition = models.CharField(max_length=50, blank=True, default="")
    publication_year = models.PositiveIntegerField(null=True, blank=True)
    language = models.CharField(max_length=50, blank=True, default="English")
    description = models.TextField(blank=True, default="")
    cover = models.ImageField(upload_to="library/covers/", blank=True, null=True, max_length=512)
    subject = models.CharField(max_length=120, blank=True, default="")
    learning_area = models.CharField(max_length=120, blank=True, default="")
    topic = models.CharField(max_length=200, blank=True, default="")
    grade_levels = models.CharField(
        max_length=120, blank=True, default="",
        help_text="Comma-separated grades e.g. 1,2,3 or PP1,Grade 4",
    )
    curriculum = models.CharField(max_length=80, blank=True, default="")
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.OTHER
    )
    # Legacy aggregate; prefer BookCopy count
    quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        ordering = ["title"]
        indexes = [
            models.Index(fields=["school", "title"]),
            models.Index(fields=["school", "isbn"]),
            models.Index(fields=["school", "category"]),
        ]

    def __str__(self):
        return self.title

    @property
    def copies_total(self):
        return self.copies.count()

    @property
    def copies_available(self):
        return self.copies.filter(status=BookCopy.Status.AVAILABLE).count()


class BookCopy(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        ISSUED = "ISSUED", "Issued"
        RESERVED = "RESERVED", "Reserved"
        UNDER_REPAIR = "UNDER_REPAIR", "Under repair"
        LOST = "LOST", "Lost"
        DAMAGED = "DAMAGED", "Damaged"
        WRITTEN_OFF = "WRITTEN_OFF", "Written off"

    class Condition(models.TextChoices):
        GOOD = "GOOD", "Good"
        MINOR_WEAR = "MINOR_WEAR", "Minor wear"
        DAMAGED = "DAMAGED", "Damaged"
        MISSING_PAGES = "MISSING_PAGES", "Missing pages"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="library_copies")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="copies")
    accession_number = models.CharField(max_length=64)
    barcode = models.CharField(max_length=64, blank=True, default="")
    acquisition_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    storage_location = models.CharField(max_length=120, blank=True, default="")
    condition = models.CharField(
        max_length=20, choices=Condition.choices, default=Condition.GOOD
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.AVAILABLE, db_index=True
    )
    acquisition_source = models.CharField(max_length=120, blank=True, default="")
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("school", "accession_number")]
        indexes = [models.Index(fields=["school", "status"])]

    def __str__(self):
        return f"{self.accession_number} — {self.book.title}"


class Acquisition(models.Model):
    class SourceType(models.TextChoices):
        PURCHASE = "PURCHASE", "Purchase"
        DONATION = "DONATION", "Donation"
        TRANSFER = "TRANSFER", "Transfer"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="library_acquisitions")
    source_type = models.CharField(max_length=20, choices=SourceType.choices, default=SourceType.PURCHASE)
    supplier_or_donor = models.CharField(max_length=200, blank=True, default="")
    acquisition_date = models.DateField()
    notes = models.TextField(blank=True, default="")
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-acquisition_date"]


class AcquisitionLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acquisition = models.ForeignKey(Acquisition, on_delete=models.CASCADE, related_name="lines")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="acquisition_lines")
    quantity = models.PositiveIntegerField(default=1)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)


class Borrowing(models.Model):
    """Loan transaction. Prefer copy FK; legacy rows may only have book + user."""

    class BorrowerType(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        STAFF = "STAFF", "Staff / Teacher"
        USER = "USER", "System user"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        RETURNED = "RETURNED", "Returned"
        OVERDUE = "OVERDUE", "Overdue"
        LOST = "LOST", "Lost"
        DAMAGED = "DAMAGED", "Damaged"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School, null=True, blank=True, on_delete=models.CASCADE, related_name="library_loans"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="borrowings")
    copy = models.ForeignKey(
        BookCopy, null=True, blank=True, on_delete=models.SET_NULL, related_name="loans"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="library_loans"
    )
    student = models.ForeignKey(
        "students.Student", null=True, blank=True, on_delete=models.SET_NULL, related_name="library_loans"
    )
    staff = models.ForeignKey(
        "staff.Staff", null=True, blank=True, on_delete=models.SET_NULL, related_name="library_loans"
    )
    borrower_type = models.CharField(
        max_length=16, choices=BorrowerType.choices, default=BorrowerType.USER
    )
    borrow_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    return_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    return_condition = models.CharField(max_length=20, blank=True, default="")
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="library_issues_made",
    )
    returned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="library_returns_received",
    )
    academic_year = models.CharField(max_length=20, blank=True, default="")
    term = models.CharField(max_length=40, blank=True, default="")
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        ordering = ["-borrow_date", "-created_at"]
        indexes = [
            models.Index(fields=["school", "status"]),
            models.Index(fields=["school", "due_date"]),
        ]


class Reservation(models.Model):
    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        READY = "READY", "Ready for pickup"
        FULFILLED = "FULFILLED", "Fulfilled"
        CANCELLED = "CANCELLED", "Cancelled"
        EXPIRED = "EXPIRED", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="library_reservations")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reservations")
    student = models.ForeignKey(
        "students.Student", null=True, blank=True, on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default="")


class ClassAllocation(models.Model):
    """Batch allocation of textbooks to a grade/class (individual copy accountability)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="library_class_allocations")
    name = models.CharField(max_length=200)
    grade_label = models.CharField(max_length=80, blank=True, default="")
    academic_year = models.CharField(max_length=20, blank=True, default="")
    term = models.CharField(max_length=40, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)


class ClassAllocationItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    allocation = models.ForeignKey(ClassAllocation, on_delete=models.CASCADE, related_name="items")
    copy = models.ForeignKey(BookCopy, on_delete=models.PROTECT, related_name="class_allocations")
    student = models.ForeignKey(
        "students.Student", null=True, blank=True, on_delete=models.SET_NULL
    )
    loan = models.ForeignKey(
        Borrowing, null=True, blank=True, on_delete=models.SET_NULL
    )


class Stocktake(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        CLOSED = "CLOSED", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="library_stocktakes")
    name = models.CharField(max_length=200)
    location_filter = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    started_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )


class StocktakeItem(models.Model):
    class Result(models.TextChoices):
        FOUND = "FOUND", "Found"
        MISSING = "MISSING", "Missing"
        UNREGISTERED = "UNREGISTERED", "Unregistered / extra"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stocktake = models.ForeignKey(Stocktake, on_delete=models.CASCADE, related_name="items")
    copy = models.ForeignKey(BookCopy, null=True, blank=True, on_delete=models.SET_NULL)
    accession_scanned = models.CharField(max_length=64, blank=True, default="")
    result = models.CharField(max_length=16, choices=Result.choices, default=Result.FOUND)
    notes = models.CharField(max_length=255, blank=True, default="")
    recorded_at = models.DateTimeField(auto_now_add=True)


class LibrarySettings(models.Model):
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name="library_settings")
    student_loan_days = models.PositiveIntegerField(default=14)
    staff_loan_days = models.PositiveIntegerField(default=30)
    max_active_loans_student = models.PositiveIntegerField(default=3)
    max_active_loans_staff = models.PositiveIntegerField(default=10)
    allow_student_reserve = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)


# ----- Digital library -----


class DigitalResource(models.Model):
    class ResourceType(models.TextChoices):
        EBOOK = "EBOOK", "E-book"
        PDF = "PDF", "PDF"
        EPUB = "EPUB", "EPUB"
        AUDIO = "AUDIO", "Audio book"
        VIDEO = "VIDEO", "Video"
        NOTES = "NOTES", "Teacher notes"
        REVISION = "REVISION", "Revision material"
        WORKSHEET = "WORKSHEET", "Worksheet"
        EXTERNAL = "EXTERNAL", "External link"
        OTHER = "OTHER", "Other"

    class ApprovalStatus(models.TextChoices):
        PENDING = "PENDING", "Pending approval"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    class Visibility(models.TextChoices):
        SCHOOL = "SCHOOL", "School-wide"
        GRADE = "GRADE", "Specific grades"
        TEACHERS = "TEACHERS", "Teachers only"
        PRIVATE = "PRIVATE", "Uploader / private"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="digital_resources")
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=200, blank=True, default="")
    publisher = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    resource_type = models.CharField(
        max_length=20, choices=ResourceType.choices, default=ResourceType.PDF
    )
    cover = models.ImageField(upload_to="library/digital_covers/", blank=True, null=True, max_length=512)
    file = models.FileField(upload_to="library/digital/", blank=True, null=True, max_length=512)
    external_url = models.URLField(blank=True, default="")
    grade_levels = models.CharField(max_length=120, blank=True, default="")
    subject = models.CharField(max_length=120, blank=True, default="")
    learning_area = models.CharField(max_length=120, blank=True, default="")
    topic = models.CharField(max_length=200, blank=True, default="")
    curriculum = models.CharField(max_length=80, blank=True, default="")
    language = models.CharField(max_length=50, blank=True, default="English")
    publication_year = models.PositiveIntegerField(null=True, blank=True)
    copyright_owner = models.CharField(max_length=200, blank=True, default="")
    licence_type = models.CharField(max_length=120, blank=True, default="")
    allow_download = models.BooleanField(default=False)
    allow_redistribute = models.BooleanField(default=False)
    visibility = models.CharField(
        max_length=16, choices=Visibility.choices, default=Visibility.SCHOOL
    )
    approval_status = models.CharField(
        max_length=16, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="approved_digital_resources",
    )
    file_size = models.PositiveBigIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["school", "approval_status"]),
            models.Index(fields=["school", "resource_type"]),
        ]


class ResourceAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    resource = models.ForeignKey(DigitalResource, on_delete=models.CASCADE, related_name="assignments")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    student = models.ForeignKey(
        "students.Student", null=True, blank=True, on_delete=models.CASCADE
    )
    grade_label = models.CharField(max_length=80, blank=True, default="")
    instructions = models.TextField(blank=True, default="")
    assigned_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)


class ReadingProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    resource = models.ForeignKey(DigitalResource, on_delete=models.CASCADE, related_name="progress")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    last_position = models.CharField(max_length=120, blank=True, default="")
    progress_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    completed = models.BooleanField(default=False)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("resource", "user")]


class Bookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    resource = models.ForeignKey(DigitalResource, on_delete=models.CASCADE, related_name="bookmarks")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    position = models.CharField(max_length=120)
    label = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
