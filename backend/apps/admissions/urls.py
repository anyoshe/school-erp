# from django.urls import path, include
# from rest_framework.routers import DefaultRouter
# from .views import ApplicationViewSet

# router = DefaultRouter()
# router.register(r'applications', ApplicationViewSet, basename='applications')

# urlpatterns = [
#     path('', include(router.urls)),
# ]
# admissions/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApplicationViewSet
from .views_public import PublicApplicationViewSet

router = DefaultRouter()
router.register(r'applications', ApplicationViewSet, basename='applications')

urlpatterns = [
    path('', include(router.urls)),                 # /admissions/applications/
    path('public/', include([
        path('applications/', PublicApplicationViewSet.as_view({
            'post': 'create'
        })),
    ])),
]
