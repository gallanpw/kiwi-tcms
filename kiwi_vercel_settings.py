"""Vercel settings: product profile, PostgreSQL (Neon) chosen via KIWI_DB_* env vars."""
import os
import pathlib

from tcms.settings.product import *  # noqa: F403

BASE = pathlib.Path(__file__).resolve().parent

WSGI_APPLICATION = "wsgi.application"

# upstream ships a public SECRET_KEY in tcms/settings/common.py; never reuse it
SECRET_KEY = os.environ["SECRET_KEY"]

# Vercel redirects HTTP itself and sets x-forwarded-proto
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# KIWI_DB_HOST, KIWI_DB_NAME, KIWI_DB_USER, KIWI_DB_PASSWORD are read by upstream
DATABASES["default"]["ENGINE"] = "django.db.backends.postgresql"  # noqa: F405
DATABASES["default"]["OPTIONS"] = {  # noqa: F405
    "sslmode": os.environ.get("PGSSLMODE", "require"),
}

# Vercel collects static files from static_src/ at build time and serves them
# from its CDN. static_src/ holds the built frontend (see README.md).
STATIC_ROOT = str(BASE / "staticfiles")
STATICFILES_DIRS = [str(BASE / "static_src")]

# The function filesystem is read-only except /tmp: attachments do not persist
MEDIA_ROOT = "/tmp/kiwi-uploads"
