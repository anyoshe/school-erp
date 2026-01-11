# from django.urls import path, include
# from rest_framework.routers import DefaultRouter

# from .views import (
#     UserViewSet,
#     PermissionViewSet,
#     UserPermissionViewSet,
# )

# router = DefaultRouter()

# router.register(r'users', UserViewSet, basename='users')
# router.register(r'permissions', PermissionViewSet, basename='permissions')
# router.register(r'user-permissions', UserPermissionViewSet, basename='user-permissions')

# urlpatterns = [
#     path('', include(router.urls)),
# ]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .serializers import MyTokenObtainPairSerializer
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import UserViewSet, PermissionViewSet, UserPermissionViewSet, CurrentUserView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'user-permissions', UserPermissionViewSet, basename='user-permissions')

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

urlpatterns = [
    path('', include(router.urls)),
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("me/", CurrentUserView.as_view(), name="current-user"),
]
