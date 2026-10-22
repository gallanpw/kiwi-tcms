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

if [ -n "${RENDER_EXTERNAL_HOSTNAME:-}" ]; then
    /Kiwi/manage.py set_domain "$RENDER_EXTERNAL_HOSTNAME"
fi

exec /httpd-foreground
