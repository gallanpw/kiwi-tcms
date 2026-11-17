from mcp.server.fastmcp import Context

from ..core import config
from ..core.runtime import _login, _thread


async def search_test_case(ctx: Context, product: str, query: str = "", category: str = "", key: str = "",
                          status: str = "", limit: int = 20) -> str:
    """Search test cases that already exist in Kiwi TCMS. Read-only: nothing is written. Use it before create_test_case to avoid duplicates.

    product: Kiwi product name (required). query: text matched inside the case title. category: exact category name (the suite title). key: a case key tag, e.g. KPWEB2-12. status: CONFIRMED or PROPOSED. limit: 1-100 (default 20).
    """
    if not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    kiwi = await _login(config.creds_from_context(ctx))
    found = await _thread(kiwi.first, "Product.filter", {"name": product})
    if not found:
        raise ValueError(f"Product '{product}' does not exist in Kiwi.")
    filters = {"category__product": found["id"]}
    for field, value in (("summary__icontains", query), ("category__name", category),
                         ("tag__name", key), ("case_status__name", status)):
        if value:
            filters[field] = value
    cases = await _thread(kiwi.call, "TestCase.filter", filters)
    lines = [f"Found {len(cases)} case(s) in {product}"]
    if len(cases) > limit:
        lines[0] += f", showing the first {limit}"
    for case in sorted(cases, key=lambda c: c["id"])[:limit]:
        lines.append(
            f"#{case['id']} [{case['case_status__name']}] [{case['priority__value']}] "
            f"{case['category__name']} | {case['summary']}"
        )
    return "\n".join(lines)


def register(mcp):
    mcp.tool()(search_test_case)
