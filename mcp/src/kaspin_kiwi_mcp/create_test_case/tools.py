from mcp.server.fastmcp import Context

from ..backup_test_case.formats import cases_to_pivot
from ..backup_test_case.tools import MAX_INLINE_CASES, _run_import
from ..core import config
from ..core.runtime import _login, _thread


async def create_test_case(ctx: Context, product: str, cases: list[dict], dry_run: bool = True) -> str:
    """Create NEW test cases in Kiwi TCMS (not Zebrunner). Not for running tests or creating test runs. dry_run=true (default) is a preview of the creation: nothing is written; call again with dry_run=false only after the user agrees.

    product: an EXISTING Kiwi product name; this tool never creates products. Cases are created as drafts (status PROPOSED) unless a case sets draft to false. A case whose title already exists in the same suite (the plan named by suite_path) is skipped, so re-sending is safe. Up to 100 cases per call.

    Fields per case: suite_path (required, levels joined by ' > ', e.g. Owner > Login), title (required), priority (High|Medium|Low|Trivial|Not set), draft (default true), description, preconditions, postconditions, steps (list of {"action": "...", "expected": "..."}), key (optional; only when the case already has a stable key).
    """
    if len(cases) > MAX_INLINE_CASES:
        raise ValueError(f"Send at most {MAX_INLINE_CASES} cases per call (got {len(cases)}); split them into batches.")
    cases = [{**case, "draft": True if case.get("draft") in (None, "") else case["draft"]} for case in cases]
    pivot = cases_to_pivot(cases, product, require_key=False)
    kiwi = await _login(config.creds_from_context(ctx))
    found = await _thread(kiwi.first, "Product.filter", {"name": product})
    if not found:
        raise ValueError(
            f"Product '{product}' does not exist in Kiwi; create_test_case never creates products. Check the spelling."
        )
    return await _run_import(
        config.creds_from_context(ctx), pivot, dry_run,
        create_product=False, plan_text="Created with kaspin-kiwi MCP",
    )


def register(mcp):
    mcp.tool()(create_test_case)
