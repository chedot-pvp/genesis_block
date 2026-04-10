#!/usr/bin/env sh
set -eu

cd /app

python manage.py migrate --noinput

exec gunicorn config.wsgi:application --bind 0.0.0.0:8003 --workers 2 --timeout 90
