from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Book, Borrowing
from .serializers import (
    BookSerializer,
    BookCreateUpdateSerializer,
    BorrowingSerializer,
    BorrowingCreateUpdateSerializer
)
from apps.school.support import accessible_school_ids, selected_school
from rest_framework.exceptions import PermissionDenied

# ----------------------------
# BOOK VIEWSET
# ----------------------------
class BookViewSet(ModelViewSet):
    queryset = Book.objects.all().order_by('title')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request))

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BookCreateUpdateSerializer
        return BookSerializer


# ----------------------------
# BORROWING VIEWSET
# ----------------------------
class BorrowingViewSet(ModelViewSet):
    queryset = Borrowing.objects.select_related('book', 'user').all().order_by('-borrow_date')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(
            book__school_id__in=accessible_school_ids(self.request)
        )

    def perform_create(self, serializer):
        school = selected_school(self.request)
        if serializer.validated_data["book"].school_id != school.id:
            raise PermissionDenied("The selected book does not belong to this school.")
        if not school.users.filter(pk=serializer.validated_data["user"].pk).exists():
            raise PermissionDenied("The borrower must belong to the selected school.")
        serializer.save()

    def perform_update(self, serializer):
        school = selected_school(self.request)
        book = serializer.validated_data.get("book", serializer.instance.book)
        user = serializer.validated_data.get("user", serializer.instance.user)
        if book.school_id != school.id or not school.users.filter(pk=user.pk).exists():
            raise PermissionDenied("Borrowing records must remain within the selected school.")
        serializer.save()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BorrowingCreateUpdateSerializer
        return BorrowingSerializer
