#!/usr/bin/env sh
set -eu

cd /app

python manage.py migrate --noinput

python - <<'PY'
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model

username = os.getenv("DJANGO_SUPERUSER_USERNAME", "").strip()
email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@example.com").strip()
password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "").strip()

if username and password:
    User = get_user_model()
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username=username, email=email, password=password)
        print(f"[django-admin] created superuser '{username}'")
    else:
        print(f"[django-admin] superuser '{username}' already exists")
else:
    print("[django-admin] superuser not configured (set DJANGO_SUPERUSER_USERNAME and DJANGO_SUPERUSER_PASSWORD)")
PY

exec gunicorn config.wsgi:application --bind 0.0.0.0:8002 --workers 2 --timeout 60
