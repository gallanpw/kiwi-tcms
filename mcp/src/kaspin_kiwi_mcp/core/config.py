"""Server settings (environment) and per-request user credentials.

Where things come from:
  * Server-wide, fixed (env on the server): KIWI_URL, ZEBRUNNER_URL, MCP_* options.
    The QA cannot change these, so a prompt can never send a token to an arbitrary host.
  * Per user:
      - HTTP mode (hosted): headers X-Kiwi-Username, X-Kiwi-Password,
        X-Zebrunner-Username, X-Zebrunner-Api-Token on every request.
      - stdio mode (local): env KIWI_USERNAME, KIWI_PASSWORD,
        ZEBRUNNER_USERNAME, ZEBRUNNER_API_TOKEN.
"""
import os
from dataclasses import dataclass
from urllib.parse import urlparse


class ConfigError(RuntimeError):
    pass


HEADER_NAMES = {
    "kiwi_username": ("x-kiwi-username", "KIWI_USERNAME"),
    "kiwi_password": ("x-kiwi-password", "KIWI_PASSWORD"),
    "zebrunner_username": ("x-zebrunner-username", "ZEBRUNNER_USERNAME"),
    "zebrunner_token": ("x-zebrunner-api-token", "ZEBRUNNER_API_TOKEN"),
}


def _csv(name, default=""):
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


def kiwi_url():
    url = os.environ.get("KIWI_URL", "").rstrip("/")
    if not url:
        raise ConfigError("Server setting KIWI_URL is not set")
    return url


def zebrunner_url():
    return os.environ.get("ZEBRUNNER_URL", "").rstrip("/")


def check_zebrunner_host(base_url):
    """Refuse to send credentials anywhere but the configured Zebrunner workspace."""
    host = urlparse(base_url).hostname or ""
    fixed = zebrunner_url()
    if fixed:
        if host != urlparse(fixed).hostname:
            raise ConfigError(f"Only {urlparse(fixed).hostname} is allowed as Zebrunner host, got {host}")
        return fixed
    if not host.endswith(".zebrunner.com"):
        raise ConfigError(f"Zebrunner host must end with .zebrunner.com, got {host}")
    return base_url.rstrip("/")


@dataclass(frozen=True)
class Creds:
    values: dict
    source: str  # "headers" or "environment", only used in error messages

    def get(self, *keys):
        missing = [k for k in keys if not self.values.get(k)]
        if missing:
            names = [HEADER_NAMES[k][0 if self.source == "headers" else 1] for k in missing]
            raise ConfigError(f"Missing {self.source}: " + ", ".join(names))
        return [self.values[k] for k in keys]

    @property
    def kiwi(self):
        return self.get("kiwi_username", "kiwi_password")

    @property
    def zebrunner(self):
        return self.get("zebrunner_username", "zebrunner_token")


def creds_from_context(ctx):
    """HTTP request -> headers; stdio -> environment."""
    request = getattr(ctx.request_context, "request", None) if ctx else None
    if request is not None:
        values = {k: request.headers.get(h) for k, (h, _) in HEADER_NAMES.items()}
        return Creds(values, "headers")
    return Creds({k: os.environ.get(e) for k, (_, e) in HEADER_NAMES.items()}, "environment")


def public_url(ctx=None):
    """Externally visible base of this MCP, used to build upload links."""
    fixed = os.environ.get("MCP_PUBLIC_URL", "").rstrip("/")
    if fixed:
        return fixed
    request = getattr(ctx.request_context, "request", None) if ctx else None
    if request is not None:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        return f"{proto}://{request.headers.get('host', request.url.netloc)}/mcp"
    raise ConfigError("Upload links need MCP_PUBLIC_URL (HTTP mode only)")
