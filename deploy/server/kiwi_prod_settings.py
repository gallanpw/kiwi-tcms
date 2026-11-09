"""Server settings: upstream product profile (DEBUG=False), PostgreSQL, values from .env.

Used by gunicorn on the server. Nginx terminates HTTPS and forwards
X-Forwarded-Proto, because Kiwi refuses plain HTTP (secure cookies, SSL redirect).
"""
import os
import pathlib

from tcms.settings.product import *  # noqa: F403

BASE = pathlib.Path(__file__).resolve().parents[2]


def _load_dotenv(path):
    """Minimal .env loader; variables already set in the environment win."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _csv(name):
    return [v.strip() for v in os.environ.get(name, "").split(",") if v.strip()]


_load_dotenv(BASE / ".env")

# upstream ships a public SECRET_KEY in tcms/settings/common.py; never reuse it
SECRET_KEY = os.environ["KIWI_SECRET_KEY"]

# e.g. KIWI_ALLOWED_HOSTS=tcms.example.com,199.180.128.65
ALLOWED_HOSTS = _csv("KIWI_ALLOWED_HOSTS")
# e.g. KIWI_CSRF_TRUSTED_ORIGINS=https://tcms.example.com,https://199.180.128.65
CSRF_TRUSTED_ORIGINS = _csv("KIWI_CSRF_TRUSTED_ORIGINS")

# nginx terminates TLS and sets this header; nginx does the HTTP -> HTTPS redirect
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("KIWI_DB_NAME", "kiwi"),
        "USER": os.environ.get("KIWI_DB_USER", "kiwi"),
        "PASSWORD": os.environ["KIWI_DB_PASSWORD"],
        "HOST": os.environ.get("KIWI_DB_HOST", "localhost"),
        "PORT": os.environ.get("KIWI_DB_PORT", "5432"),
    }
}

# Served by nginx (see nginx-kiwi.conf); keep outside /home so www-data can read them
STATIC_ROOT = os.environ.get("KIWI_STATIC_ROOT", "/var/www/kiwi/static")
MEDIA_ROOT = os.environ.get("KIWI_MEDIA_ROOT", "/var/www/kiwi/uploads")

# superusers see every plan and unfinished run on the dashboard (see kiwi_custom_package/dashboard.py)
ROOT_URLCONF = "kiwi_custom_package.urls"
TEMPLATES[0]["DIRS"].insert(0, str(BASE / "kiwi_templates"))  # noqa: F405
