"""Minimal Kiwi TCMS JSON-RPC client (endpoint /json-rpc/, session cookie after Auth.login)."""
import httpx


class KiwiError(RuntimeError):
    pass


class KiwiClient:
    def __init__(self, url, username, password, transport=None):
        self.url, self.username, self.password = url.rstrip("/"), username, password
        self.http = httpx.Client(base_url=self.url, timeout=60, follow_redirects=False, transport=transport)
        self._id = 0
        self._session = None

    def call(self, method, *params):
        self._id += 1
        headers = {"Content-Type": "application/json"}
        if self._session:
            headers["Cookie"] = f"sessionid={self._session}"
        resp = self.http.post(
            "/json-rpc/",
            headers=headers,
            json={"jsonrpc": "2.0", "id": self._id, "method": method, "params": list(params)},
        )
        if resp.status_code >= 300:
            raise KiwiError(f"Kiwi HTTP {resp.status_code} on {resp.url} (check KIWI_URL / ALLOWED_HOSTS)")
        body = resp.json()
        if body.get("error"):
            raise KiwiError(f"{method}: {body['error'].get('message')}")
        return body.get("result")

    def login(self):
        self._session = None
        self._session = self.call("Auth.login", self.username, self.password)
        return self

    def first(self, method, query):
        found = self.call(method, query)
        return found[0] if found else None
