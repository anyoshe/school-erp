from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Book, Borrowing
from .serializers import (
    BookSerializer,
    BookCreateUpdateSerializer,
    BorrowingSerializer,
    BorrowingCreateUpdateSerializer
)

# ----------------------------
# BOOK VIEWSET
# ----------------------------
class BookViewSet(ModelViewSet):
    queryset = Book.objects.all().order_by('title')
    permission_classes = [IsAuthenticated]

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

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BorrowingCreateUpdateSerializer
        return BorrowingSerializer
