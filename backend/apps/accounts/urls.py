from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .serializers import MyTokenObtainPairSerializer
from .views import (
    UserViewSet,
    PermissionViewSet,
    UserPermissionViewSet,
    CurrentUserView,
    ChangePasswordView,
    RoleViewSet,
    SchoolUserViewSet,
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'roles', RoleViewSet, basename='roles')
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'user-permissions', UserPermissionViewSet, basename='user-permissions')

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

urlpatterns = [
    # All ViewSet endpoints (users, roles, permissions, etc.)
    path('', include(router.urls)),

    # JWT auth
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Current user & password
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    # School-specific users (nested under accounts)
    path(
        'schools/<uuid:school_id>/users/',
        SchoolUserViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='school-users-list-create'
    ),
    path(
        'schools/<uuid:school_id>/users/<uuid:pk>/',
        SchoolUserViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}),
        name='school-user-detail'
    ),
]