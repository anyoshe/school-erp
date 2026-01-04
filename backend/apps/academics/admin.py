from django.contrib import admin
from .models import AcademicLevel, Class, Subject, Exam, Result

admin.site.register(AcademicLevel)
admin.site.register(Class)
admin.site.register(Subject)
admin.site.register(Exam)
admin.site.register(Result)
