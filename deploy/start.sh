#!/bin/bash
# Container entrypoint for Render: prepare the DB, then hand over to upstream.
set -eu

/Kiwi/manage.py migrate --noinput
/Kiwi/manage.py refresh_permissions

# Render's free plan has no shell, so create the admin from env vars.
# Fails harmlessly on later boots because the user already exists.
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ]; then
    /Kiwi/manage.py createsuperuser --noinput || true
fi

# hostname env var set by the platform (Render or Fly.io)
domain="${RENDER_EXTERNAL_HOSTNAME:-}"
if [ -z "$domain" ] && [ -n "${FLY_APP_NAME:-}" ]; then
    domain="$FLY_APP_NAME.fly.dev"
fi
if [ -n "$domain" ]; then
    /Kiwi/manage.py set_domain "$domain"
fi

exec /httpd-foreground
