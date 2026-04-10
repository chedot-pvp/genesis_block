import os
from pathlib import Path
from datetime import timedelta


BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_V2_SECRET_KEY", "django-v2-unsafe-secret-change-me")
DEBUG = os.getenv("DJANGO_V2_DEBUG", "0") == "1"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_V2_ALLOWED_HOSTS", "game5.chedot.com,localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "api",
]

MIDDLEWARE = [
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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "genesis_v2"),
        "USER": os.getenv("POSTGRES_USER", "genesis"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "genesis"),
        "HOST": os.getenv("POSTGRES_HOST", "postgres"),
        "PORT": int(os.getenv("POSTGRES_PORT", "5432")),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Do not use SimpleJWT's JWTAuthentication globally: our access tokens carry
# `player_id` (custom Player model), not Django User `user_id`, which causes
# "Token contained no recognizable user identification" on every Bearer request.
# Protected views use api.views.get_player_id_from_request instead.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ALGORITHM": "HS256",
    "SIGNING_KEY": os.getenv("DJANGO_V2_JWT_SECRET", SECRET_KEY),
}
