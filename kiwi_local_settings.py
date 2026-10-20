"""Local dev settings: devel profile, DB (SQLite/PostgreSQL) chosen via .env."""
import os
import pathlib

from tcms.settings.devel import *  # noqa: F403

BASE = pathlib.Path(__file__).resolve().parent


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


_load_dotenv(BASE / ".env")

KIWI_DB = os.environ.get("KIWI_DB", "sqlite").lower()

if KIWI_DB == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(BASE / "data" / "db.sqlite3"),
        }
    }
elif KIWI_DB == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("KIWI_DB_NAME", "kiwi"),
            "USER": os.environ.get("KIWI_DB_USER", "kiwi"),
            "PASSWORD": os.environ.get("KIWI_DB_PASSWORD", "kiwi"),
            "HOST": os.environ.get("KIWI_DB_HOST", "localhost"),
            "PORT": os.environ.get("KIWI_DB_PORT", "5432"),
        }
    }
else:
    raise ValueError("KIWI_DB must be 'sqlite' or 'postgres', got %r" % KIWI_DB)

MEDIA_ROOT = str(BASE / "data" / "uploads")
STATIC_ROOT = str(BASE / "data" / "static")

# devel profile uses a test-only storage (needs factory_boy); use the stock one
STORAGES["staticfiles"]["BACKEND"] = "django.contrib.staticfiles.storage.StaticFilesStorage"  # noqa: F405
