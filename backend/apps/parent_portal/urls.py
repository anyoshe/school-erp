from django.urls import path
from .views import ParentChildrenView, ParentChildResultsView, ParentLinkStudentView

urlpatterns = [
    path("children/", ParentChildrenView.as_view(), name="parent-children"),
    path("children/<uuid:student_id>/results/", ParentChildResultsView.as_view(), name="parent-child-results"),
    path("link-student/", ParentLinkStudentView.as_view(), name="parent-link-student"),
]
