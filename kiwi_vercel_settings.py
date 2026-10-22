"""Vercel settings: product profile, PostgreSQL (Neon) chosen via KIWI_DB_* env vars."""
import os
import pathlib

import django.core.management
from django.utils.functional import Promise
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


# Vercel's build-time reader (vc_django_settings.py) dumps every setting to JSON
# before the app registry is ready, which fails on upstream's lazy gettext and
# reverse_lazy values. Blank them for that one process only (it replaces
# execute_from_command_line with a stub named _stop); the function and
# collectstatic still load the real settings.
def _without_lazy(value):
    if isinstance(value, Promise):
        return ""
    if isinstance(value, (list, tuple)):
        return type(value)(_without_lazy(v) for v in value)
    if isinstance(value, dict):
        return {k: _without_lazy(v) for k, v in value.items()}
    return value


if django.core.management.execute_from_command_line.__name__ == "_stop":
    for _name in [n for n in dir() if n.isupper()]:
        globals()[_name] = _without_lazy(globals()[_name])
