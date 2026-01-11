
# from django.contrib import admin
# from django.urls import path, include
# from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
# from apps.students.views import StudentViewSet
# from django.conf import settings
# from django.conf.urls.static import static

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

#     # 🔑 STUDENTS (explicit, no router conflict)
#     path('api/students/', StudentViewSet.as_view({
#         'get': 'list',
#         'post': 'create',
#     })),
#     path('api/students/<uuid:pk>/', StudentViewSet.as_view({
#         'get': 'retrieve',
#         'patch': 'partial_update',
#         'delete': 'destroy',
#     })),

#     # Sub-resources
#     path('api/students/', include('apps.students.urls')),
#     path('api/schools/', include('apps.school.urls')),

# ]

# # Add this at the very end
# if settings.DEBUG:
#     urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


# config/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.students.views import StudentViewSet
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # ACCOUNTS API
    path('api/accounts/', include('apps.accounts.urls')),

    # JWT AUTH
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # All other apps (your existing ones)
    path('api/academics/', include('apps.academics.urls')),
    path('api/admissions/', include('apps.admissions.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/core/', include('apps.core.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/library/', include('apps.library.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/staff/', include('apps.staff.urls')),

    # STUDENTS (your explicit paths - keep them)
    path('api/students/', StudentViewSet.as_view({
        'get': 'list',
        'post': 'create',
    })),
    path('api/students/<uuid:pk>/', StudentViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'delete': 'destroy',
    })),
    path('api/students/', include('apps.students.urls')),  # if needed

    # SCHOOL & MODULES - change to this to expose /api/schools/ and /api/modules/
    path('api/', include('apps.school.urls')),  # ← Key fix: no 'schools/' prefix

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)