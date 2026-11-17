from mcp.server.fastmcp import Context

from ..backup_test_case.formats import CREATE_FORMAT_HELP, cases_to_pivot, csv_text_to_rows, group_create_rows
from ..backup_test_case.tools import MAX_INLINE_CASES, _run_import
from ..core import config
from ..core.runtime import _login, _thread


async def _create_pivot(ctx, pivot, dry_run):
    product = pivot["product"]
    creds = config.creds_from_context(ctx)
    kiwi = await _login(creds)
    found = await _thread(kiwi.first, "Product.filter", {"name": product})
    if not found:
        raise ValueError(
            f"Product '{product}' does not exist in Kiwi; create_test_case never creates products. Check the spelling."
        )
    return await _run_import(
        creds, pivot, dry_run, create_product=False, plan_text="Created with kaspin-kiwi MCP",
    )


async def create_test_case(ctx: Context, product: str, cases: list[dict], dry_run: bool = True) -> str:
    """Create NEW test cases in Kiwi TCMS (not Zebrunner). Not for running tests or creating test runs. dry_run=true (default) is a preview of the creation: nothing is written; call again with dry_run=false only after the user agrees.

    product: an EXISTING Kiwi product name; this tool never creates products. Cases are created as drafts (status PROPOSED) unless a case sets draft to false. A case whose title already exists in the same suite (the plan named by suite_path) is skipped, so re-sending is safe. Up to 100 cases per call.

    Fields per case: suite_path (required, levels joined by ' > ', e.g. Owner > Login), title (required), priority (High|Medium|Low|Trivial|Not set), draft (default true), description, preconditions, postconditions, steps (list of {"action": "...", "expected": "..."}), key (optional; only when the case already has a stable key). priority must be High, Medium, Low, Trivial or Not set and draft must be yes or no; other values are rejected.
    """
    if len(cases) > MAX_INLINE_CASES:
        raise ValueError(f"Send at most {MAX_INLINE_CASES} cases per call (got {len(cases)}); split them into batches.")
    cases = [{**case, "draft": True if case.get("draft") in (None, "") else case["draft"]} for case in cases]
    pivot = cases_to_pivot(cases, product, require_key=False, strict_values=True)
    return await _create_pivot(ctx, pivot, dry_run)


async def create_test_case_csv(ctx: Context, product: str, csv_text: str, dry_run: bool = True) -> str:
    """Create NEW test cases in Kiwi TCMS (not Zebrunner) from a table sent as CSV text. Not for running tests or creating test runs. dry_run=true (default) is a preview of the creation: nothing is written; call again with dry_run=false only after the user agrees.

    Use it for a CSV file, an Excel file (.xlsx) or a Google Sheet that follows the fixed template: read the FIRST sheet / the tab that holds the cases and send it as CSV text with the header row exactly as in the template (call get_create_format first). Do not rename or add columns; unknown columns are rejected. One row per step; a row with a title starts a new case, the rows below it with an empty title are its further steps. Cases are created as drafts (status PROPOSED) unless draft is no; the product must already exist; a title that already exists in the same suite is skipped, so re-sending is safe. Up to 100 cases and 1,000,000 characters per call.
    """
    if len(csv_text) > 1_000_000:
        raise ValueError(
            "csv_text is too large (over 1,000,000 characters); split it into batches of up to 100 cases."
        )
    cases = group_create_rows(csv_text_to_rows(csv_text))
    cases = [{**case, "draft": True if case.get("draft") in (None, "") else case["draft"]} for case in cases]
    pivot = cases_to_pivot(cases, product, require_key=False, strict_values=True)
    if len(cases) > MAX_INLINE_CASES:
        raise ValueError(f"Send at most {MAX_INLINE_CASES} cases per call (got {len(cases)}); split them into batches.")
    return await _create_pivot(ctx, pivot, dry_run)


def get_create_format() -> str:
    """Describe the fixed table format (columns, rules, example) for creating NEW test cases from CSV, Excel or Google Sheets. Read it before building the table for create_test_case_csv."""
    return CREATE_FORMAT_HELP


def register(mcp):
    mcp.tool()(create_test_case)
    mcp.tool()(create_test_case_csv)
    mcp.tool()(get_create_format)
