from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Report
from .serializers import ReportSerializer, ReportCreateUpdateSerializer

# ----------------------------
# REPORT VIEWSET
# ----------------------------
class ReportViewSet(ModelViewSet):
    queryset = Report.objects.select_related('created_by').all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ReportCreateUpdateSerializer
        return ReportSerializer
