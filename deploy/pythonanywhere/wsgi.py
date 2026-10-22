# Paste this into the WSGI file shown on the PythonAnywhere Web tab
# (/var/www/<username>_pythonanywhere_com_wsgi.py), replacing its contents.
# Replace USERNAME with the PythonAnywhere username.
import os
import sys

BASE = "/home/USERNAME/kiwi-tcms"

for path in (BASE, BASE + "/Kiwi", BASE + "/deploy/pythonanywhere"):
    if path not in sys.path:
        sys.path.insert(0, path)

os.environ["DJANGO_SETTINGS_MODULE"] = "kiwi_pa_settings"

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
