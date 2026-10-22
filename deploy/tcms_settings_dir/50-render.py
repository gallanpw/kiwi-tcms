# Loaded by tcms.settings.product via tcms.utils.settings.import_local_settings,
# executed in the settings module scope.
import os

# upstream ships a public SECRET_KEY in tcms/settings/common.py; never reuse it
SECRET_KEY = os.environ["SECRET_KEY"]

# Render terminates TLS; without this SECURE_SSL_REDIRECT loops forever
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
