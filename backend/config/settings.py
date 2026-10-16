"""
Django settings for config project.
"""

import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured


# Load environment variables from .env
load_dotenv()

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------
# SECURITY AND ENVIRONMENT CONFIGURATION
# ---------------------------------------------------------------------

DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-local-development-only"
    else:
        raise ImproperlyConfigured(
            "SECRET_KEY must be set when DEBUG=False."
        )

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv(
        "ALLOWED_HOSTS", "localhost,127.0.0.1"
    ).split(",")
    if host.strip()
]


# ---------------------------------------------------------------------
# APPLICATION DEFINITION
# ---------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "corsheaders",

    "apps.accounts",
    "apps.students",
    "apps.staff",
    "apps.academics.apps.AcademicsConfig",
    "apps.finance",
    "apps.attendance",
    "apps.library",
    "apps.admissions",
    "apps.reports",
    "apps.core",
    "apps.school",
    "apps.inventory",
    "apps.transport",
    "apps.parent_portal",
    "apps.elearning",
    "apps.health",
    "apps.events",
    "apps.alumni",
    "apps.procurement",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# ---------------------------------------------------------------------
# DATABASE CONFIGURATION
# Supports Neon PostgreSQL in production and local PostgreSQL in dev.
# ---------------------------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    url = urlparse(DATABASE_URL)

    if not url.hostname or not url.path.lstrip("/"):
        raise ImproperlyConfigured(
            "DATABASE_URL must contain a database name and hostname."
        )

    DATABASES = {
    # Reuse DB connections (helps Neon / remote Postgres on refresh)
    # Applied via default entry CONN_MAX_AGE below when present.

        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": url.path.lstrip("/"),
            "USER": url.username,
            "PASSWORD": url.password,
            "HOST": url.hostname,
            "PORT": url.port or 5432,
            "OPTIONS": {
                "sslmode": "require",
            },
        }
    }
else:
    if not DEBUG:
        raise ImproperlyConfigured(
            "DATABASE_URL must be set in production."
        )

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("LOCAL_DB_NAME", "school_erp"),
            "USER": os.getenv("LOCAL_DB_USER", "anyoshe"),
            "PASSWORD": os.getenv("LOCAL_DB_PASSWORD", ""),
            "HOST": os.getenv("LOCAL_DB_HOST", "localhost"),
            "PORT": os.getenv("LOCAL_DB_PORT", "5432"),
        }
    }


# ---------------------------------------------------------------------
# PASSWORD VALIDATION
# ---------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# ---------------------------------------------------------------------
# INTERNATIONALIZATION
# ---------------------------------------------------------------------

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# ---------------------------------------------------------------------
# STATIC AND MEDIA FILES
# ---------------------------------------------------------------------

STATIC_URL = "static/"

MEDIA_URL = "/media/"

MEDIA_ROOT = os.path.join(BASE_DIR, "media")


# ---------------------------------------------------------------------
# CUSTOM USER MODEL
# ---------------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"


# ---------------------------------------------------------------------
# DJANGO REST FRAMEWORK AND JWT AUTHENTICATION
# ---------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.school.authentication.SchoolContextJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": (
        "rest_framework_simplejwt.tokens.AccessToken",
    ),
    "TOKEN_OBTAIN_SERIALIZER": (
        "apps.accounts.serializers.MyTokenObtainPairSerializer"
    ),
}


# ---------------------------------------------------------------------
# CORS CONFIGURATION
# In development, all origins are allowed.
# In production, configure CORS_ALLOWED_ORIGINS in the environment.
# ---------------------------------------------------------------------

CORS_ALLOW_ALL_ORIGINS = DEBUG

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS", ""
    ).split(",")
    if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    "authorization",
    "content-type",
    "x-school-id",
    "x-school-support-id",
]


# ---------------------------------------------------------------------
# CSRF TRUSTED ORIGINS
# Add trusted HTTPS origins here if Django admin or other CSRF-protected
# requests require them in production.
# ---------------------------------------------------------------------

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CSRF_TRUSTED_ORIGINS", ""
    ).split(",")
    if origin.strip()
]


# ---------------------------------------------------------------------
# EMAIL CONFIGURATION
# Uses environment variables for deployment credentials.
# ---------------------------------------------------------------------

EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
)

EMAIL_HOST = os.getenv(
    "EMAIL_HOST", "mail.privateemail.com"
)

EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))

EMAIL_USE_TLS = True

EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")

EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")

DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    "Admissions <hello@getaxe.tech>",
)