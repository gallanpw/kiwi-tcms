"""One-time upload links for files too big to pass through the AI chat.

Flow: AI calls create_upload_link -> user opens the link and picks the file (or the AI runs
`curl --data-binary @file`) -> AI calls import_uploaded_file. The link token only allows
uploading; importing still needs the same user's Kiwi credentials.
"""
import json
import os
import pathlib
import re
import secrets
import tempfile
import time

from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse

TTL = 900  # seconds a link stays valid
MAX_BYTES = 5 * 1024 * 1024
ALLOWED = (".csv", ".xlsx", ".json")
TOKEN = re.compile(r"^[A-Za-z0-9_-]{20,64}$")
_dir = None
_links = {}


class UploadError(RuntimeError):
    pass


def _folder():
    global _dir
    if _dir is None:
        _dir = pathlib.Path(os.environ.get("MCP_UPLOAD_DIR") or tempfile.mkdtemp(prefix="kaspin-kiwi-"))
        _dir.mkdir(parents=True, exist_ok=True)
    return _dir


def _purge():
    now = time.time()
    for token in [t for t, v in _links.items() if v["expires"] < now]:
        path = _links.pop(token)["path"]
        if path:
            path.unlink(missing_ok=True)


def create(owner):
    _purge()
    token = secrets.token_urlsafe(24)
    _links[token] = {"owner": owner, "expires": time.time() + TTL, "path": None, "name": None}
    return token


def take(token, owner):
    """Return (path, original name) of the uploaded file and forget the link."""
    _purge()
    link = _links.get(token)
    if not link or link["owner"] != owner:
        raise UploadError("Unknown or expired upload id for this user")
    if not link["path"]:
        raise UploadError("Nothing uploaded yet for this id; upload the file first")
    del _links[token]
    return link["path"], link["name"]


PAGE = """<!doctype html><meta charset=utf-8><title>Upload test cases</title>
<style>body{font:16px system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem}</style>
<h1>Upload test cases</h1><p>.csv, .xlsx or .json, max 5 MB. This link works once.</p>
<input type=file id=f accept=".csv,.xlsx,.json"> <button id=b>Upload</button><p id=m></p>
<script>
document.getElementById('b').onclick = async () => {
  const file = document.getElementById('f').files[0], m = document.getElementById('m');
  if (!file) { m.textContent = 'Choose a file first.'; return; }
  const r = await fetch(location.pathname, {method: 'POST', body: file, headers: {'X-Filename': file.name}});
  const j = await r.json(); m.textContent = r.ok ? 'Uploaded. Go back to the chat and tell the AI it is done.' : j.error;
};
</script>"""


async def handle(request: Request):
    token = request.path_params["token"]
    link = _links.get(token) if TOKEN.match(token) else None
    if not link or link["expires"] < time.time():
        return JSONResponse({"error": "Upload link is unknown or expired"}, status_code=404)
    if request.method == "GET":
        return HTMLResponse(PAGE)
    if link["path"]:
        return JSONResponse({"error": "Already uploaded"}, status_code=409)
    name = os.path.basename(request.headers.get("x-filename", "upload"))
    suffix = pathlib.Path(name).suffix.lower()
    if suffix not in ALLOWED:
        return JSONResponse({"error": f"Only {', '.join(ALLOWED)} files are accepted"}, status_code=400)
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_BYTES:
            return JSONResponse({"error": "File is larger than 5 MB"}, status_code=413)
    if not data:
        return JSONResponse({"error": "Empty file"}, status_code=400)
    path = _folder() / f"{token}{suffix}"
    path.write_bytes(bytes(data))
    link["path"], link["name"] = path, name
    return JSONResponse({"ok": True, "bytes": len(data), "name": json.dumps(name)[1:-1]})
