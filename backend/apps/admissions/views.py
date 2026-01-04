from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions
from .models import Application
# from .serializers import ApplicationSerializer
from .serializers import ApplicationSerializer, ApplicationCreateUpdateSerializer
from rest_framework.permissions import IsAuthenticated

# ----------------------------
# APPLICATION VIEWSET
# ----------------------------
class ApplicationViewSet(ModelViewSet):
    queryset = Application.objects.select_related('class_applied').all().order_by('-submitted_at')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """
        Use separate serializers for read vs write
        """
        if self.action in ['create', 'update', 'partial_update']:
            return ApplicationCreateUpdateSerializer
        return ApplicationSerializer
