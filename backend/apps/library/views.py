from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.school.support import accessible_school_ids, selected_school
from apps.students.models import Student
from apps.staff.models import Staff

from .models import (
    Book, BookCopy, Borrowing, Acquisition, Reservation, ClassAllocation, ClassAllocationItem,
    Stocktake, StocktakeItem, LibrarySettings, DigitalResource, ResourceAssignment,
    ReadingProgress, Bookmark,
)
from .serializers import (
    BookSerializer, BookCreateUpdateSerializer, BookCopySerializer,
    BorrowingSerializer, BorrowingCreateUpdateSerializer, IssueSerializer,
    ReturnSerializer, RegisterCopiesSerializer, AcquisitionSerializer,
    ReservationSerializer, ClassAllocationSerializer, StocktakeSerializer,
    LibrarySettingsSerializer, DigitalResourceSerializer, ResourceAssignmentSerializer,
    ReadingProgressSerializer, BookmarkSerializer,
)
from . import services
from .permissions import (
    CanManageCatalogue, CanIssueReturn, CanApproveDigital, CanManageStocktake,
    CanManageAllocations, CanManageSettings, is_student, is_librarian, is_teacher,
    can_manage_physical,
)



def _school(request):
    school = selected_school(request)
    if not school:
        raise ValidationError("School context required (X-School-ID).")
    if school.id not in accessible_school_ids(request):
        raise PermissionDenied("No access to this school.")
    return school


class BookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CanManageCatalogue]

    def get_queryset(self):
        qs = Book.objects.filter(school_id__in=accessible_school_ids(self.request)).annotate(
            _copies_total=Count("copies"),
            _copies_available=Count("copies", filter=Q(copies__status=BookCopy.Status.AVAILABLE)),
        )
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | Q(author__icontains=q) | Q(isbn__icontains=q) | Q(subject__icontains=q)
            )
        cat = self.request.query_params.get("category")
        if cat:
            qs = qs.filter(category=cat)
        return qs.order_by("title")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return BookCreateUpdateSerializer
        return BookSerializer

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = BookSerializer(instance).data
        data["copies_total"] = instance.copies.count()
        data["copies_available"] = instance.copies.filter(status=BookCopy.Status.AVAILABLE).count()
        return Response(data)

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        ser = BookSerializer(page or qs, many=True)
        data = ser.data
        # attach annotated counts
        id_map = {str(b.id): b for b in (page or qs)}
        for row in data:
            b = id_map.get(str(row["id"]))
            if b is not None:
                row["copies_total"] = getattr(b, "_copies_total", b.copies.count())
                row["copies_available"] = getattr(b, "_copies_available", 0)
        if page is not None:
            return self.get_paginated_response(data)
        return Response(data)

    @action(detail=False, methods=["post"], url_path="register-copies")
    def register_copies(self, request):
        school = _school(request)
        ser = RegisterCopiesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        book = Book.objects.filter(pk=d["book_id"], school=school).first()
        if not book:
            raise ValidationError("Book not found for this school.")
        copies = services.register_copies(
            school=school,
            book=book,
            count=d["count"],
            accession_prefix=d.get("accession_prefix") or "",
            start_number=d.get("start_number"),
            storage_location=d.get("storage_location") or "",
            acquisition_source=d.get("acquisition_source") or "",
            acquisition_date=d.get("acquisition_date"),
            purchase_price=d.get("purchase_price"),
        )
        return Response(BookCopySerializer(copies, many=True).data, status=status.HTTP_201_CREATED)


class BookCopyViewSet(viewsets.ModelViewSet):
    serializer_class = BookCopySerializer
    permission_classes = [IsAuthenticated, CanManageCatalogue]

    def get_queryset(self):
        qs = BookCopy.objects.filter(school_id__in=accessible_school_ids(self.request)).select_related("book")
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        book = self.request.query_params.get("book")
        if book:
            qs = qs.filter(book_id=book)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(accession_number__icontains=q) | Q(book__title__icontains=q))
        return qs.order_by("accession_number")

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))


class BorrowingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CanIssueReturn]

    def get_queryset(self):
        qs = Borrowing.objects.filter(
            Q(school_id__in=accessible_school_ids(self.request))
            | Q(book__school_id__in=accessible_school_ids(self.request))
        ).select_related("book", "copy", "student", "staff", "user")
        if is_student(self.request.user):
            qs = qs.filter(user=self.request.user)
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        if self.request.query_params.get("overdue") == "1":
            qs = qs.filter(status__in=[Borrowing.Status.ACTIVE, Borrowing.Status.OVERDUE], due_date__lt=timezone.localdate())
        return qs.order_by("-borrow_date")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return BorrowingCreateUpdateSerializer
        return BorrowingSerializer

    def perform_create(self, serializer):
        school = selected_school(self.request)
        serializer.save(school=school)

    @action(detail=False, methods=["post"])
    def issue(self, request):
        school = _school(request)
        ser = IssueSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        copy = BookCopy.objects.filter(pk=d["copy_id"], school=school).select_related("book").first()
        if not copy:
            raise ValidationError("Copy not found.")
        student = staff = None
        if d.get("student_id"):
            student = Student.objects.filter(pk=d["student_id"], school=school).first()
            if not student:
                raise ValidationError("Student not found.")
        if d.get("staff_id"):
            staff = Staff.objects.filter(pk=d["staff_id"], school=school).first()
            if not staff:
                raise ValidationError("Staff not found.")
        loan = services.issue_copy(
            school=school,
            copy=copy,
            borrow_date=d.get("borrow_date"),
            due_date=d.get("due_date"),
            student=student,
            staff=staff,
            user=request.user if not student and not staff else None,
            issued_by=request.user,
            academic_year=d.get("academic_year") or "",
            term=d.get("term") or "",
            remarks=d.get("remarks") or "",
        )
        return Response(BorrowingSerializer(loan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def return_loan(self, request, pk=None):
        school = _school(request)
        loan = self.get_queryset().filter(pk=pk).first()
        if not loan or (loan.school_id and loan.school_id != school.id):
            raise ValidationError("Loan not found.")
        ser = ReturnSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        loan = services.return_loan(
            loan=loan,
            return_date=d.get("return_date"),
            condition=d.get("condition") or "",
            returned_to=request.user,
            mark_lost=d.get("mark_lost") or False,
            mark_damaged=d.get("mark_damaged") or False,
            remarks=d.get("remarks") or "",
        )
        return Response(BorrowingSerializer(loan).data)


class AcquisitionViewSet(viewsets.ModelViewSet):
    serializer_class = AcquisitionSerializer
    permission_classes = [IsAuthenticated, CanManageCatalogue]

    def get_queryset(self):
        return Acquisition.objects.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), created_by=self.request.user)


class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Reservation.objects.filter(school_id__in=accessible_school_ids(self.request)).select_related("book")
        if is_student(self.request.user):
            qs = qs.filter(user=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))


class ClassAllocationViewSet(viewsets.ModelViewSet):
    serializer_class = ClassAllocationSerializer
    permission_classes = [IsAuthenticated, CanManageAllocations]

    def get_queryset(self):
        return ClassAllocation.objects.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), created_by=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        data = ClassAllocationSerializer(obj).data
        items = obj.items.select_related("copy", "student", "loan", "copy__book")
        data["items"] = [
            {
                "id": str(i.id),
                "copy_id": str(i.copy_id),
                "accession_number": i.copy.accession_number if i.copy_id else None,
                "book_title": i.copy.book.title if i.copy_id else None,
                "student_id": str(i.student_id) if i.student_id else None,
                "student_name": (
                    f"{i.student.first_name} {i.student.last_name}".strip()
                    if i.student_id else None
                ),
                "loan_id": str(i.loan_id) if i.loan_id else None,
                "loan_status": i.loan.status if i.loan_id else None,
            }
            for i in items
        ]
        return Response(data)

    @action(detail=False, methods=["post"], url_path="allocate")
    def allocate(self, request):
        school = _school(request)
        book_id = request.data.get("book_id")
        book = Book.objects.filter(pk=book_id, school=school).first()
        if not book:
            raise ValidationError("Book not found.")
        individual = str(request.data.get("individual", "true")).lower() in ("1", "true", "yes")
        student_ids = request.data.get("student_ids") or []
        if isinstance(student_ids, str):
            student_ids = [s for s in student_ids.split(",") if s.strip()]
        alloc, items = services.allocate_class_textbooks(
            school=school,
            name=request.data.get("name") or "",
            grade_label=request.data.get("grade_label") or "",
            academic_year=request.data.get("academic_year") or "",
            term=request.data.get("term") or "",
            book=book,
            student_ids=student_ids,
            quantity=request.data.get("quantity"),
            individual=individual,
            created_by=request.user,
            due_date=request.data.get("due_date") or None,
            notes=request.data.get("notes") or "",
        )
        return Response(
            {"id": str(alloc.id), "name": alloc.name, "items_count": len(items)},
            status=status.HTTP_201_CREATED,
        )


class StocktakeViewSet(viewsets.ModelViewSet):
    serializer_class = StocktakeSerializer
    permission_classes = [IsAuthenticated, CanManageStocktake]

    def get_queryset(self):
        return Stocktake.objects.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def scan(self, request, pk=None):
        school = _school(request)
        st = self.get_queryset().filter(pk=pk, school=school).first()
        if not st or st.status != Stocktake.Status.OPEN:
            raise ValidationError("Open stocktake not found.")
        accession = (request.data.get("accession_number") or "").strip()
        if not accession:
            raise ValidationError("accession_number required.")
        copy = BookCopy.objects.filter(school=school, accession_number=accession).first()
        item = StocktakeItem.objects.create(
            stocktake=st,
            copy=copy,
            accession_scanned=accession,
            result=StocktakeItem.Result.FOUND if copy else StocktakeItem.Result.UNREGISTERED,
            notes=request.data.get("notes") or "",
        )
        return Response({"id": str(item.id), "result": item.result, "copy_id": str(copy.id) if copy else None})
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        school = _school(request)
        st = self.get_queryset().filter(pk=pk, school=school).first()
        if not st:
            raise ValidationError("Stocktake not found.")
        # mark expected-but-not-scanned as MISSING
        scanned_ids = set(
            st.items.exclude(copy_id=None).values_list("copy_id", flat=True)
        )
        qs = BookCopy.objects.filter(school=school)
        loc = (st.location_filter or "").strip()
        if loc:
            qs = qs.filter(storage_location__icontains=loc)
        missing = 0
        for copy in qs.exclude(id__in=scanned_ids):
            StocktakeItem.objects.get_or_create(
                stocktake=st,
                copy=copy,
                defaults={
                    "accession_scanned": copy.accession_number,
                    "result": StocktakeItem.Result.MISSING,
                },
            )
            missing += 1
        st.status = Stocktake.Status.CLOSED
        st.closed_at = timezone.now()
        st.save(update_fields=["status", "closed_at"])
        summary = {
            "found": st.items.filter(result=StocktakeItem.Result.FOUND).count(),
            "missing": st.items.filter(result=StocktakeItem.Result.MISSING).count(),
            "unregistered": st.items.filter(result=StocktakeItem.Result.UNREGISTERED).count(),
        }
        return Response({"status": st.status, "summary": summary})

    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        school = _school(request)
        st = self.get_queryset().filter(pk=pk, school=school).first()
        if not st:
            raise ValidationError("Stocktake not found.")
        items = st.items.select_related("copy", "copy__book")
        return Response({
            "id": str(st.id),
            "name": st.name,
            "status": st.status,
            "items": [
                {
                    "accession": i.accession_scanned or (i.copy.accession_number if i.copy_id else ""),
                    "title": i.copy.book.title if i.copy_id else "",
                    "result": i.result,
                    "notes": i.notes,
                }
                for i in items
            ],
        })


class DigitalResourceViewSet(viewsets.ModelViewSet):
    serializer_class = DigitalResourceSerializer
    permission_classes = [IsAuthenticated, CanApproveDigital]

    def get_queryset(self):
        qs = DigitalResource.objects.filter(school_id__in=accessible_school_ids(self.request))
        role = (getattr(self.request.user, "role", None) or "").upper()
        if role in ("STUDENT", "PARENT"):
            qs = qs.filter(approval_status=DigitalResource.ApprovalStatus.APPROVED)
        st = self.request.query_params.get("approval_status")
        if st and role not in ("STUDENT", "PARENT"):
            qs = qs.filter(approval_status=st)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(subject__icontains=q))
        grade = self.request.query_params.get("grade")
        if grade:
            qs = qs.filter(grade_levels__icontains=grade)
        subject = self.request.query_params.get("subject")
        if subject:
            qs = qs.filter(subject__icontains=subject)
        return qs

    def perform_create(self, serializer):
        school = selected_school(self.request)
        f = self.request.FILES.get("file")
        extra = {
            "approval_status": DigitalResource.ApprovalStatus.PENDING,
        }
        if f:
            name = (getattr(f, "name", "") or "").lower()
            allowed_ext = (".pdf", ".epub", ".png", ".jpg", ".jpeg", ".webp", ".mp3", ".mp4", ".m4a", ".wav")
            if not any(name.endswith(ext) for ext in allowed_ext):
                raise ValidationError("Unsupported file type. Allowed: PDF, EPUB, images, common audio/video.")
            max_bytes = 50 * 1024 * 1024
            if getattr(f, "size", 0) > max_bytes:
                raise ValidationError("File must be 50 MB or smaller.")
            extra["file_size"] = f.size
            extra["mime_type"] = getattr(f, "content_type", "") or ""
        elif not (self.request.data.get("external_url") or serializer.validated_data.get("external_url")):
            # Allow metadata-only external later; for file-less require external URL
            pass
        serializer.save(school=school, uploaded_by=self.request.user, **extra)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        school = _school(request)
        obj = self.get_queryset().filter(pk=pk, school=school).first()
        if not obj:
            raise ValidationError("Not found.")
        obj.approval_status = DigitalResource.ApprovalStatus.APPROVED
        obj.approved_by = request.user
        obj.save(update_fields=["approval_status", "approved_by", "updated_at"])
        return Response(DigitalResourceSerializer(obj).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        school = _school(request)
        obj = self.get_queryset().filter(pk=pk, school=school).first()
        if not obj:
            raise ValidationError("Not found.")
        obj.approval_status = DigitalResource.ApprovalStatus.REJECTED
        obj.approved_by = request.user
        obj.save(update_fields=["approval_status", "approved_by", "updated_at"])
        return Response(DigitalResourceSerializer(obj).data)


class ResourceAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = ResourceAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ResourceAssignment.objects.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), assigned_by=self.request.user)


class ReadingProgressViewSet(viewsets.ModelViewSet):
    serializer_class = ReadingProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReadingProgress.objects.filter(
            school_id__in=accessible_school_ids(self.request), user=self.request.user
        )

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), user=self.request.user)


class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(
            school_id__in=accessible_school_ids(self.request), user=self.request.user
        )

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), user=self.request.user)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated, CanManageSettings])
def library_settings(request):
    school = _school(request)
    obj = services.get_or_create_settings(school)
    if request.method == "GET":
        return Response(LibrarySettingsSerializer(obj).data)
    ser = LibrarySettingsSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def library_dashboard(request):
    school = _school(request)
    services.mark_overdue(school)
    titles = Book.objects.filter(school=school).count()
    copies = BookCopy.objects.filter(school=school)
    active = Borrowing.objects.filter(school=school, status=Borrowing.Status.ACTIVE)
    overdue = Borrowing.objects.filter(
        school=school, status__in=[Borrowing.Status.OVERDUE, Borrowing.Status.ACTIVE], due_date__lt=timezone.localdate()
    )
    dig = DigitalResource.objects.filter(school=school)
    return Response({
        "physical": {
            "titles": titles,
            "copies_total": copies.count(),
            "copies_available": copies.filter(status=BookCopy.Status.AVAILABLE).count(),
            "copies_issued": copies.filter(status=BookCopy.Status.ISSUED).count(),
            "overdue_loans": overdue.count(),
            "lost_damaged": copies.filter(status__in=[BookCopy.Status.LOST, BookCopy.Status.DAMAGED]).count(),
        },
        "digital": {
            "total": dig.count(),
            "approved": dig.filter(approval_status=DigitalResource.ApprovalStatus.APPROVED).count(),
            "pending": dig.filter(approval_status=DigitalResource.ApprovalStatus.PENDING).count(),
        },
        "recent_loans": BorrowingSerializer(
            Borrowing.objects.filter(school=school).select_related("book", "copy", "student")[:8],
            many=True,
        ).data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def library_reports(request):
    """Summary reports for librarians/admins."""
    school = _school(request)
    role = (getattr(request.user, "role", None) or "").upper()
    if role in ("STUDENT", "PARENT") and not is_librarian(request.user):
        raise PermissionDenied("Not authorized for library reports.")
    services.mark_overdue(school)
    copies = BookCopy.objects.filter(school=school)
    loans = Borrowing.objects.filter(school=school)
    dig = DigitalResource.objects.filter(school=school)
    allocations = ClassAllocation.objects.filter(school=school)
    return Response({
        "physical": {
            "titles": Book.objects.filter(school=school).count(),
            "copies_total": copies.count(),
            "available": copies.filter(status=BookCopy.Status.AVAILABLE).count(),
            "issued": copies.filter(status=BookCopy.Status.ISSUED).count(),
            "overdue": loans.filter(
                status__in=[Borrowing.Status.OVERDUE, Borrowing.Status.ACTIVE],
                due_date__lt=timezone.localdate(),
            ).count(),
            "lost_damaged": copies.filter(
                status__in=[BookCopy.Status.LOST, BookCopy.Status.DAMAGED]
            ).count(),
        },
        "allocations": {
            "batches": allocations.count(),
            "items": ClassAllocationItem.objects.filter(allocation__school=school).count(),
        },
        "digital": {
            "approved": dig.filter(approval_status=DigitalResource.ApprovalStatus.APPROVED).count(),
            "pending": dig.filter(approval_status=DigitalResource.ApprovalStatus.PENDING).count(),
            "by_subject": list(
                dig.filter(approval_status=DigitalResource.ApprovalStatus.APPROVED)
                .exclude(subject="")
                .values("subject")
                .annotate(n=Count("id"))
                .order_by("-n")[:20]
            ),
        },
    })
