# apps/school/views.py (or views_public.py)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from .models import School
from .serializers import SchoolSerializer  # ← use your existing one or create a minimal one

class PublicSchoolDetailView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, slug):
        try:
            school = School.objects.get(slug=slug)
            serializer = SchoolSerializer(school)  # or a minimal PublicSchoolSerializer
            return Response(serializer.data)
        except School.DoesNotExist:
            return Response(
                {"detail": "School not found"},
                status=status.HTTP_404_NOT_FOUND
            )