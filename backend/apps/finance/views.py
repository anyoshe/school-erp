# apps/finance/views.py
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import FeeCategory, FeeItem
from .serializers import (
    FeeCategorySerializer,
    FeeCategoryCreateUpdateSerializer,
    FeeItemSerializer,
    FeeItemCreateUpdateSerializer
)
from apps.core.permissions import IsAssociatedWithSchool

class FeeCategoryViewSet(ModelViewSet):
    """
    Manage fee categories (Tuition, Admission, Uniform, etc.)
    """
    queryset = FeeCategory.objects.all().order_by('display_order', 'name')
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeCategoryCreateUpdateSerializer
        return FeeCategorySerializer

    def get_queryset(self):
        # Multi-tenancy: only user's school
        user = self.request.user
        return self.queryset.filter(school__users=user)
   # ADD THIS METHOD (or override if create already exists)
    def create(self, request, *args, **kwargs):
        # === DEBUG PRINTS - place them here ===
        print("\n" + "="*100)
        print("DEBUG: Incoming request.method:", request.method)
        print("DEBUG: Incoming Content-Type:", request.content_type)
        print("DEBUG: Raw request.data type:", type(request.data))
        print("DEBUG: Raw request.data keys:", list(request.data.keys()))
        print("DEBUG: Raw 'school' value received:", request.data.get('school'))
        print("DEBUG: Full raw request.data:", dict(request.data))
        print("="*100 + "\n")

        # Continue with normal creation
        return super().create(request, *args, **kwargs)

class FeeItemViewSet(ModelViewSet):
    """
    Manage individual fee items with flexible assignment to grades/departments
    """
    queryset = FeeItem.objects.select_related('category').prefetch_related('grade_levels', 'departments').all()
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FeeItemCreateUpdateSerializer
        return FeeItemSerializer

    def get_queryset(self):
        user = self.request.user
        return self.queryset.filter(category__school__users=user)