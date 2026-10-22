"""WSGI entrypoint for Vercel (see tool.vercel.entrypoint in pyproject.toml)."""
import os
import pathlib
import sys

BASE = pathlib.Path(__file__).resolve().parent
sys.path[:0] = [str(BASE), str(BASE / "Kiwi")]
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kiwi_vercel_settings")

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
