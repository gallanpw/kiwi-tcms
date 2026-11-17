import csv
import io
import os

from mcp.server.fastmcp import Context

from ..core import config, jobs
from ..core.runtime import _login, _thread
from . import uploads, zebrunner
from .formats import FORMAT_HELP, cases_to_pivot, read_pivot, rows_to_pivot, write_pivot
from .importer import format_report, import_pivot, new_report


BACKGROUND_FROM = 30  # more cases than this -> run as a background job
MAX_INLINE_CASES = 100  # import_cases / import_csv_text; bigger files are sent in batches
MAX_CASES = 1000

UPLOAD_ENABLED = os.environ.get("MCP_ENABLE_UPLOAD", "").strip().lower() in ("1", "true", "yes")


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


async def import_from_zebrunner(ctx: Context, url: str, dry_run: bool = True) -> str:
    """Import (copy/migrate/back up) test cases from Zebrunner INTO Kiwi TCMS.

    Not for running tests or creating test runs. dry_run=true is a preview of the import (nothing is
    written); it is NOT a test execution.

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


def get_file_format() -> str:
    """Describe the CSV/XLSX/JSON test case format accepted by the import tools."""
    if UPLOAD_ENABLED:
        return FORMAT_HELP + "\nLarge files can also go through create_upload_link, then import_uploaded_file."
    return FORMAT_HELP


async def import_cases(ctx: Context, cases: list[dict], product: str, dry_run: bool = True) -> str:
    """Import up to 100 test cases given as data (see get_file_format for the fields).

    product: Kiwi product name; an unknown name creates a NEW product (the dry run warns about it).
    Bigger files: send them in several calls of up to 100 cases (existing keys are skipped, so
    re-sending is safe).
    """
    if len(cases) > MAX_INLINE_CASES:
        raise ValueError(f"Send at most {MAX_INLINE_CASES} cases per call (got {len(cases)}); split them into batches.")
    pivot = cases_to_pivot(cases, product)
    return await _run_import(config.creds_from_context(ctx), pivot, dry_run)


async def import_csv_text(ctx: Context, csv_text: str, product: str, dry_run: bool = True) -> str:
    """Import test cases from CSV text (columns in get_file_format), up to 100 cases."""
    pivot = rows_to_pivot(csv.DictReader(io.StringIO(csv_text.lstrip("﻿"))), product)
    if len(pivot["cases"]) > MAX_INLINE_CASES:
        raise ValueError(f"Send at most {MAX_INLINE_CASES} cases per call; split bigger files into batches.")
    return await _run_import(config.creds_from_context(ctx), pivot, dry_run)


async def get_import_status(ctx: Context, job_id: str) -> str:
    """Progress and result of a background import job."""
    job = jobs.get(job_id, config.creds_from_context(ctx).kiwi[0])
    text = format_report(job["report"])
    if job["state"] == "failed":
        return f"FAILED: {job['error']}\n{text}"
    return ("done\n" if job["state"] == "done" else "running\n") + text


def register(mcp):
    mcp.tool()(check_connection)
    mcp.tool()(import_from_zebrunner)
    mcp.tool()(get_file_format)
    mcp.tool()(import_cases)
    mcp.tool()(import_csv_text)
    mcp.tool()(get_import_status)


def register_upload(app):
    """One-time upload links for big files. Off by default: it adds a public URL to the server.
    Enable with MCP_ENABLE_UPLOAD=1."""

    @app.tool()
    async def create_upload_link(ctx: Context) -> str:
        """Get a one-time link (valid 15 minutes) to upload a CSV/XLSX/JSON file of any size up to 5 MB.

        Give the link to the user to open in a browser, or upload it yourself with
        `curl --data-binary @file -H "X-Filename: file.xlsx" <link>`. Then call import_uploaded_file.
        """
        creds = config.creds_from_context(ctx)
        token = uploads.create(creds.kiwi[0])
        link = f"{config.public_url(ctx)}/upload/{token}"
        return f"Upload link (valid {uploads.TTL // 60} minutes, one file): {link}\nupload_id: {token}"


    @app.tool()
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

    app.custom_route("/mcp/upload/{token}", methods=["GET", "POST"])(uploads.handle)


def register_local(mcp):
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
