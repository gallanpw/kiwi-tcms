"""MCP server "kaspin kiwi".

Two ways to run (same tools, same code):
  kaspin-kiwi-mcp --http     hosted next to Kiwi, behind nginx; credentials come as request headers
  kaspin-kiwi-mcp            local stdio on a laptop; credentials come from environment variables
"""
import argparse
import json
import logging
import os
import sys

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.responses import JSONResponse

from .core import config
from .backup_test_case import tools
from .backup_test_case.tools import register_upload as _register_upload

logging.getLogger("httpx").setLevel(logging.WARNING)  # request URLs are noise in the client log

mcp = FastMCP(
    "kaspin-kiwi",
    instructions=(
        "Imports test cases INTO Kiwi TCMS: copy them from Zebrunner (suite URL or single case URL), or from "
        "CSV/XLSX/JSON data. This server never runs tests and never creates test runs in Zebrunner. "
        "'dry run' here means a preview of the import: nothing is written. "
        "Always preview first (dry_run=true), show the report, and write (dry_run=false) only after the user agrees. "
        "Call get_file_format before building case data from a user's spreadsheet."
    ),
    stateless_http=True,  # credentials ride on every request; restarts do not break client sessions
    json_response=True,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=["127.0.0.1:*", "localhost:*", "[::1]:*", *config._csv("MCP_ALLOWED_HOSTS")],
        allowed_origins=["http://127.0.0.1:*", "http://localhost:*", *config._csv("MCP_ALLOWED_ORIGINS")],
    ),
)


tools.register(mcp)


@mcp.custom_route("/mcp/health", methods=["GET"])
async def health(_request):
    return JSONResponse({"status": "ok", "service": "kaspin-kiwi"})


if tools.UPLOAD_ENABLED:
    _register_upload(mcp)


def _register_local_tools():
    """File-path tools read/write the disk of the machine running the server, so they exist
    only in local stdio mode. A hosted server must never expose them."""
    tools.register_local(mcp)


def client_config():
    """Config snippet for a local stdio client (Claude Code / Desktop, Cursor, Codex...).

    Uses this exact Python (absolute path), so it works for a GUI app whose PATH is minimal.
    """
    placeholders = {
        "KIWI_URL": "https://<domain-kiwi>",
        "KIWI_USERNAME": "<username kiwi>",
        "KIWI_PASSWORD": "<password kiwi>",
        "ZEBRUNNER_URL": "https://<workspace>.zebrunner.com",
        "ZEBRUNNER_USERNAME": "<username login zebrunner>",
        "ZEBRUNNER_API_TOKEN": "<api key zebrunner kamu>",
    }
    server = {"command": sys.executable, "args": ["-m", "kaspin_kiwi_mcp"], "env": placeholders}
    return {"mcpServers": {"kaspin-kiwi": server}}


def main(argv=None):
    parser = argparse.ArgumentParser(prog="kaspin-kiwi-mcp", description=__doc__.split("\n\n")[0])
    parser.add_argument("--http", action="store_true", help="serve Streamable HTTP (hosted mode)")
    parser.add_argument("--host", default=os.environ.get("MCP_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("MCP_PORT", "8765")))
    parser.add_argument("--print-config", action="store_true", help="print a local stdio client config and exit")
    args = parser.parse_args(argv)
    if args.print_config:
        print(json.dumps(client_config(), indent=2))
        return
    if args.http:
        config.kiwi_url()  # fail at start, not on the first request
        mcp.settings.host, mcp.settings.port = args.host, args.port
        mcp.run("streamable-http")
    else:
        _register_local_tools()
        mcp.run()


if __name__ == "__main__":
    main()
