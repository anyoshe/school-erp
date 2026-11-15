from django.urls import path
from . import views

urlpatterns = [
    path("routes/", views.RouteListCreateView.as_view(), name="transport-routes"),
    path("routes/<int:pk>/", views.RouteDetailView.as_view(), name="transport-route-detail"),
    path(
        "routes/for-billing/",
        views.TransportRoutesForBillingView.as_view(),
        name="transport-routes-billing",
    ),
    path(
        "assignments/",
        views.StudentTransportAssignmentsView.as_view(),
        name="transport-assignments",
    ),
    path(
        "students/<uuid:student_id>/subscribe/",
        views.StudentTransportSubscribeView.as_view(),
        name="transport-subscribe",
    ),
    path(
        "assignments/<int:assignment_id>/deactivate/",
        views.StudentTransportDeactivateView.as_view(),
        name="transport-deactivate",
    ),
]
