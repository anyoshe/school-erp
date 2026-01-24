from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # 1. Admin (standard)
    path('admin/', admin.site.urls),

    # 2. JWT Auth - CRITICAL (first)
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # 3. Accounts & Users (critical - user management)
    path('api/accounts/', include('apps.accounts.urls')),

    # 3. Core Multi-Tenancy (School setup - your foundation)
    path('api/', include('apps.school.urls')),

    # 4. PHASE 1: Students + Admissions (your current work)
    path('api/students/', include('apps.students.urls')),
    path('api/admissions/', include('apps.admissions.urls')),

    # 5. PHASE 2 Priority: Staff + Finance (M-Pesa, fees for Kenyan schools)
    path('api/staff/', include('apps.staff.urls')),
    path('api/finance/', include('apps.finance.urls')),

    # 6. Academic Flow (attendance → academics)
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/academics/', include('apps.academics.urls')),

    # 7. Supporting modules (alphabetical)
    path('api/library/', include('apps.library.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/core/', include('apps.core.urls')),
    # path('api/parent-portal/', include('apps.parent_portal.urls')),
    # path('api/elearning/', include('apps.elearning.urls')),
    # path('api/health/', include('apps.health.urls')),
    # path('api/events/', include('apps.events.urls')),
    # path('api/alumni/', include('apps.alumni.urls')),
    # path('api/transport/', include('apps.transport.urls')),
    # path('api/inventory/', include('apps.inventory.urls')),
    # path('api/procurement/', include('apps.procurement.urls')),
    

    # 8. Media (debug only)
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)