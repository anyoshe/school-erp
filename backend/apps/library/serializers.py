from rest_framework import serializers
from .models import Book, Borrowing
from apps.accounts.serializers import UserSerializer

# ----------------------------
# BOOK SERIALIZERS
# ----------------------------

class BookSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes book details
    """
    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'author',
            'quantity'
        ]


class BookCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For adding or editing books
    """
    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'author',
            'quantity'
        ]


# ----------------------------
# BORROWING SERIALIZERS
# ----------------------------

class BorrowingSerializer(serializers.ModelSerializer):
    """
    READ-ONLY: Includes book and user info
    """
    book_title = serializers.CharField(source='book.title', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Borrowing
        fields = [
            'id',
            'book',
            'book_title',
            'user',
            'user_email',
            'borrow_date',
            'return_date'
        ]


class BorrowingCreateUpdateSerializer(serializers.ModelSerializer):
    """
    CREATE / UPDATE: For borrowing or returning books
    """
    class Meta:
        model = Borrowing
        fields = [
            'id',
            'book',
            'user',
            'borrow_date',
            'return_date'
        ]
