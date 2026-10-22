"""PythonAnywhere settings: product profile, SQLite, config from .env."""
import os
import pathlib

BASE = pathlib.Path(__file__).resolve().parents[2]


def _load_dotenv(path):
    """Minimal .env loader; variables already set in the shell win."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


# Before the import below: upstream reads some env vars (for example
# KIWI_REGISTRATION_ENABLED) while the settings module loads.
_load_dotenv(BASE / ".env")

from tcms.settings.product import *  # noqa: E402,F403

# upstream ships a public SECRET_KEY in tcms/settings/common.py; never reuse it
SECRET_KEY = os.environ["SECRET_KEY"]

# <username>.pythonanywhere.com
KIWI_HOSTNAME = os.environ["KIWI_HOSTNAME"]
ALLOWED_HOSTS = [KIWI_HOSTNAME]
CSRF_TRUSTED_ORIGINS = ["https://" + KIWI_HOSTNAME]

# PythonAnywhere terminates TLS and redirects HTTP itself ("Force HTTPS" on
# the Web tab), so Django must not redirect as well.
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

DATA_DIR = pathlib.Path(os.environ.get("KIWI_DATA_DIR", BASE / "data"))

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(DATA_DIR / "db.sqlite3"),
    }
}

MEDIA_ROOT = str(DATA_DIR / "uploads")
STATIC_ROOT = str(DATA_DIR / "static")

# node_modules is not on the server, the built static files are uploaded
STATICFILES_DIRS = [d for d in STATICFILES_DIRS if os.path.isdir(d)]  # noqa: F405
