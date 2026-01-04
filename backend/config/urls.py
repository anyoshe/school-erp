# from django.contrib import admin
# from django.urls import path, include

# from rest_framework_simplejwt.views import (
#     TokenObtainPairView,
#     TokenRefreshView,
# )

# urlpatterns = [
#     path('admin/', admin.site.urls),

#     # ACCOUNTS API
#     path('api/accounts/', include('apps.accounts.urls')),

#     # JWT AUTH
#     path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
#     path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
#     path('api/academics/', include('apps.academics.urls')),
#     path('api/admissions/', include('apps.admissions.urls')),
#     path('api/attendance/', include('apps.attendance.urls')),
#     path('api/core/', include('apps.core.urls')),
#     path('api/finance/', include('apps.finance.urls')),
#     path('api/library/', include('apps.library.urls')),
#     path('api/reports/', include('apps.reports.urls')),
#     path('api/staff/', include('apps.staff.urls')),
#     path('api/students/', include('apps.students.urls')),

# ]
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.students.views import StudentViewSet

urlpatterns = [
    path('admin/', admin.site.urls),

    # ACCOUNTS API
    path('api/accounts/', include('apps.accounts.urls')),

    # JWT AUTH
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('api/academics/', include('apps.academics.urls')),
    path('api/admissions/', include('apps.admissions.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/core/', include('apps.core.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/library/', include('apps.library.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/staff/', include('apps.staff.urls')),

    # 🔑 STUDENTS (explicit, no router conflict)
    path('api/students/', StudentViewSet.as_view({
        'get': 'list',
        'post': 'create',
    })),
    path('api/students/<uuid:pk>/', StudentViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'delete': 'destroy',
    })),

    # Sub-resources
    path('api/students/', include('apps.students.urls')),
]

