from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Report
from .serializers import ReportSerializer, ReportCreateUpdateSerializer
from apps.school.support import accessible_school_ids, selected_school

# ----------------------------
# REPORT VIEWSET
# ----------------------------
class ReportViewSet(ModelViewSet):
    queryset = Report.objects.select_related('created_by').all()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(school_id__in=accessible_school_ids(self.request))

    def perform_create(self, serializer):
        serializer.save(school=selected_school(self.request), created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(school=selected_school(self.request))

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ReportCreateUpdateSerializer
        return ReportSerializer
