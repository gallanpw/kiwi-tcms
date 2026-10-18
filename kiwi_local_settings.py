"""Local dev settings: devel profile with SQLite stored in ./data."""
import pathlib

from tcms.settings.devel import *  # noqa: F403

BASE = pathlib.Path(__file__).resolve().parent

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(BASE / "data" / "db.sqlite3"),
    }
}

MEDIA_ROOT = str(BASE / "data" / "uploads")
STATIC_ROOT = str(BASE / "data" / "static")

# devel profile uses a test-only storage (needs factory_boy); use the stock one
STORAGES["staticfiles"]["BACKEND"] = "django.contrib.staticfiles.storage.StaticFilesStorage"  # noqa: F405
