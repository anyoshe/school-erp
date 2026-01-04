from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookViewSet, BorrowingViewSet

router = DefaultRouter()
router.register(r'books', BookViewSet, basename='books')
router.register(r'borrowings', BorrowingViewSet, basename='borrowings')

urlpatterns = [
    path('', include(router.urls)),
]
