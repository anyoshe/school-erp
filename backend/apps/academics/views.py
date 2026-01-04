# from django.shortcuts import render

# # Create your views here.
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Class, Subject, Exam, Result
from .serializers import (
    ClassSerializer,
    ClassCreateUpdateSerializer,
    SubjectSerializer,
    SubjectCreateUpdateSerializer,
    ExamSerializer,
    ExamCreateUpdateSerializer,
    ResultSerializer,
    ResultCreateUpdateSerializer,
)


# ----------------------------
# CLASS VIEWSET
# ----------------------------
class ClassViewSet(ModelViewSet):
    queryset = Class.objects.all().order_by('level')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ClassCreateUpdateSerializer
        return ClassSerializer


# ----------------------------
# SUBJECT VIEWSET
# ----------------------------
class SubjectViewSet(ModelViewSet):
    queryset = Subject.objects.select_related('teacher').all().order_by('name')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SubjectCreateUpdateSerializer
        return SubjectSerializer


# ----------------------------
# EXAM VIEWSET
# ----------------------------
class ExamViewSet(ModelViewSet):
    queryset = Exam.objects.all().order_by('term', 'session')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ExamCreateUpdateSerializer
        return ExamSerializer


# ----------------------------
# RESULT VIEWSET
# ----------------------------
class ResultViewSet(ModelViewSet):
    queryset = Result.objects.select_related('student', 'subject', 'exam').all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ResultCreateUpdateSerializer
        return ResultSerializer
