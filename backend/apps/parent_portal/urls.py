from django.urls import path

from .views import (
    ParentChildrenView,
    ParentChildOverviewView,
    ParentChildResultsView,
    ParentChildFeesView,
    ParentChildAttendanceView,
    ParentLinkStudentView,
    ParentInviteView,
    ParentDirectoryView,
    ParentUnlinkView,
    ParentUnlinkDeleteView,
)

urlpatterns = [
    path("children/", ParentChildrenView.as_view(), name="parent-children"),
    path(
        "children/<uuid:student_id>/overview/",
        ParentChildOverviewView.as_view(),
        name="parent-child-overview",
    ),
    path(
        "children/<uuid:student_id>/results/",
        ParentChildResultsView.as_view(),
        name="parent-child-results",
    ),
    path(
        "children/<uuid:student_id>/fees/",
        ParentChildFeesView.as_view(),
        name="parent-child-fees",
    ),
    path(
        "children/<uuid:student_id>/attendance/",
        ParentChildAttendanceView.as_view(),
        name="parent-child-attendance",
    ),
    path("link-student/", ParentLinkStudentView.as_view(), name="parent-link-student"),
    path("invite/", ParentInviteView.as_view(), name="parent-invite"),
    path("directory/", ParentDirectoryView.as_view(), name="parent-directory"),
    path("unlink/", ParentUnlinkView.as_view(), name="parent-unlink"),
    path("links/<int:link_id>/", ParentUnlinkDeleteView.as_view(), name="parent-link-delete"),
]
