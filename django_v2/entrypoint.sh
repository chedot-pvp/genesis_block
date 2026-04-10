#!/usr/bin/env sh
set -eu

cd /app

if [ "${WAIT_FOR_DB:-1}" = "1" ]; then
  python - <<'PY'
import os
import time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.db import connections

for attempt in range(30):
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
        print("Database is ready")
        break
    except Exception as exc:
        if attempt == 29:
            raise SystemExit(f"Database is not ready: {exc}")
        time.sleep(2)
PY
fi

python manage.py migrate --noinput

exec gunicorn config.wsgi:application --bind 0.0.0.0:8003 --workers 2 --timeout 90
