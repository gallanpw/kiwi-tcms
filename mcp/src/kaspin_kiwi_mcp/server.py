"""MCP server "kaspin kiwi".

Two ways to run (same tools, same code):
  kaspin-kiwi-mcp --http     hosted next to Kiwi, behind nginx; credentials come as request headers
  kaspin-kiwi-mcp            local stdio on a laptop; credentials come from environment variables
"""
import argparse
import csv
import io
import json
import logging
import os
import sys

import anyio
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.responses import JSONResponse

from . import config, jobs, uploads, zebrunner
from .formats import FORMAT_HELP, cases_to_pivot, read_pivot, rows_to_pivot, write_pivot
from .importer import format_report, import_pivot, new_report
from .kiwi import KiwiClient

logging.getLogger("httpx").setLevel(logging.WARNING)  # request URLs are noise in the client log

BACKGROUND_FROM = 30  # more cases than this -> run as a background job
MAX_INLINE_CASES = 100  # import_cases / import_csv_text; bigger files go through upload
MAX_CASES = 1000

mcp = FastMCP(
    "kaspin-kiwi",
    instructions=(
        "Copy Zebrunner test cases (suite URL or single case URL) into Kiwi TCMS, or import CSV/XLSX/JSON. "
        "Always run with dry_run=true first, show the report, and only write (dry_run=false) after the user agrees. "
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


async def _thread(fn, *args):
    return await anyio.to_thread.run_sync(lambda: fn(*args))


async def _login(creds):
    user, password = creds.kiwi
    return await _thread(lambda: KiwiClient(config.kiwi_url(), user, password).login())


async def _run_import(creds, pivot, dry_run):
    count = len(pivot["cases"])
    if count == 0:
        return "No test cases found, nothing to do."
    if count > MAX_CASES:
        raise ValueError(f"{count} cases is over the limit of {MAX_CASES} per import; split the source.")
    kiwi = await _login(creds)
    report = new_report(pivot, dry_run)
    if count <= BACKGROUND_FROM:
        await _thread(import_pivot, kiwi, pivot, dry_run, report)
        return format_report(report)
    job_id = jobs.start(creds.kiwi[0], report, lambda: import_pivot(kiwi, pivot, dry_run, report))
    return (
        f"{count} cases: running in the background as job {job_id} "
        f"({'dry run' if dry_run else 'writing to Kiwi'}). "
        f"Call get_import_status('{job_id}') about every 15 seconds until it reports done."
    )


@mcp.tool()
async def check_connection(ctx: Context, zebrunner_url: str = "") -> str:
    """Check the Kiwi login and, when a Zebrunner project/suite URL is given, Zebrunner access.

    Run this first. Never prints passwords or tokens.
    """
    creds = config.creds_from_context(ctx)
    kiwi = await _login(creds)
    lines = [f"Kiwi OK: logged in to {kiwi.url} as {kiwi.username}"]
    if zebrunner_url:
        url = zebrunner.parse_url(zebrunner_url)
        base = config.check_zebrunner_host(url.base)
        user, token = creds.zebrunner
        total = await zebrunner.count_suites(base, user, token, url.project)
        lines.append(f"Zebrunner OK: project {url.project} has {total} suites")
    return "\n".join(lines)


@mcp.tool()
async def import_from_zebrunner(ctx: Context, url: str, dry_run: bool = True) -> str:
    """Copy test cases from Zebrunner into Kiwi.

    url: a Zebrunner suite URL (.../projects/KEY/test-cases?suiteId=N) copies the test cases of that
    suite and all its child suites. Its parent suites are created only as empty plans so the tree keeps
    its place; their own test cases are NOT imported (give the parent's URL for that). A single case URL
    (...?caseId=N) copies that case. Without either, the whole project.
    dry_run=true (default) only reports; call again with dry_run=false after the user agrees.
    """
    creds = config.creds_from_context(ctx)
    parsed = zebrunner.parse_url(url)
    base = config.check_zebrunner_host(parsed.base)
    user, token = creds.zebrunner
    pivot = await zebrunner.fetch_pivot(base, user, token, parsed)
    return await _run_import(creds, pivot, dry_run)


@mcp.tool()
def get_file_format() -> str:
    """Describe the CSV/XLSX/JSON test case format accepted by the import tools."""
    return FORMAT_HELP


@mcp.tool()
async def import_cases(ctx: Context, cases: list[dict], product: str, dry_run: bool = True) -> str:
    """Import up to 100 test cases given as data (see get_file_format for the fields).

    product: Kiwi product name; an unknown name creates a NEW product (the dry run warns about it).
    For bigger files use create_upload_link instead.
    """
    if len(cases) > MAX_INLINE_CASES:
        raise ValueError(f"Send at most {MAX_INLINE_CASES} cases per call (got {len(cases)}); or use create_upload_link.")
    pivot = cases_to_pivot(cases, product)
    return await _run_import(config.creds_from_context(ctx), pivot, dry_run)


@mcp.tool()
async def import_csv_text(ctx: Context, csv_text: str, product: str, dry_run: bool = True) -> str:
    """Import test cases from CSV text (columns in get_file_format), up to 100 cases."""
    pivot = rows_to_pivot(csv.DictReader(io.StringIO(csv_text.lstrip("﻿"))), product)
    if len(pivot["cases"]) > MAX_INLINE_CASES:
        raise ValueError(f"Send at most {MAX_INLINE_CASES} cases per call; use create_upload_link for bigger files.")
    return await _run_import(config.creds_from_context(ctx), pivot, dry_run)


@mcp.tool()
async def create_upload_link(ctx: Context) -> str:
    """Get a one-time link (valid 15 minutes) to upload a CSV/XLSX/JSON file of any size up to 5 MB.

    Give the link to the user to open in a browser, or upload it yourself with
    `curl --data-binary @file -H "X-Filename: file.xlsx" <link>`. Then call import_uploaded_file.
    """
    creds = config.creds_from_context(ctx)
    token = uploads.create(creds.kiwi[0])
    link = f"{config.public_url(ctx)}/upload/{token}"
    return f"Upload link (valid {uploads.TTL // 60} minutes, one file): {link}\nupload_id: {token}"


@mcp.tool()
async def import_uploaded_file(ctx: Context, upload_id: str, product: str = "", dry_run: bool = True) -> str:
    """Import the file uploaded through create_upload_link.

    product: Kiwi product name; required for CSV/XLSX and JSON lists. An unknown name creates a NEW
    product (the dry run warns about it).
    """
    creds = config.creds_from_context(ctx)
    path, _name = uploads.take(upload_id, creds.kiwi[0])
    try:
        pivot = await _thread(read_pivot, path, product)
    finally:
        path.unlink(missing_ok=True)
    return await _run_import(creds, pivot, dry_run)


@mcp.tool()
async def get_import_status(ctx: Context, job_id: str) -> str:
    """Progress and result of a background import job."""
    job = jobs.get(job_id, config.creds_from_context(ctx).kiwi[0])
    text = format_report(job["report"])
    if job["state"] == "failed":
        return f"FAILED: {job['error']}\n{text}"
    return ("done\n" if job["state"] == "done" else "running\n") + text


@mcp.custom_route("/mcp/health", methods=["GET"])
async def health(_request):
    return JSONResponse({"status": "ok", "service": "kaspin-kiwi"})


mcp.custom_route("/mcp/upload/{token}", methods=["GET", "POST"])(uploads.handle)


def _register_local_tools():
    """File-path tools read/write the disk of the machine running the server, so they exist
    only in local stdio mode. A hosted server must never expose them."""

    @mcp.tool()
    async def import_file(ctx: Context, path: str, product: str = "", dry_run: bool = True) -> str:
        """Import test cases from a local .json, .csv or .xlsx file. product is required for CSV/XLSX."""
        pivot = await _thread(read_pivot, path, product)
        return await _run_import(config.creds_from_context(ctx), pivot, dry_run)

    @mcp.tool()
    async def zebrunner_backup(ctx: Context, url: str, out_path: str) -> str:
        """Save a Zebrunner suite (or single case) to a local file; format from the extension (.json/.csv/.xlsx)."""
        creds = config.creds_from_context(ctx)
        parsed = zebrunner.parse_url(url)
        base = config.check_zebrunner_host(parsed.base)
        user, token = creds.zebrunner
        pivot = await zebrunner.fetch_pivot(base, user, token, parsed)
        saved = await _thread(write_pivot, pivot, out_path)
        return f"Saved {len(pivot['suites'])} suites, {len(pivot['cases'])} cases to {saved}"


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
