"""Read test cases from Zebrunner through its documented MCP endpoint
(https://zebrunner.com/documentation/guide/mcp/): {workspace}/api/mcp, Streamable HTTP,
headers X-Zebrunner-Username and X-Zebrunner-Api-Token. Result: a pivot dict (see formats.py).

Suite URLs (?suiteId=) give that suite, its child suites and its ancestors (so the plan tree
keeps its place); case URLs (?caseId=) give one case plus the ancestors of its suite.
"""
import json
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

PAGE_SIZE = 100
SUITE_IDS_PER_REQUEST = 50


class ZebrunnerError(RuntimeError):
    pass


@dataclass(frozen=True)
class ZebrunnerUrl:
    base: str
    project: str
    suite_id: int = None
    case_id: int = None


def parse_url(url):
    """https://host/projects/KEY/test-cases?suiteId=1 (or ?caseId=2) -> ZebrunnerUrl."""
    parsed = urlparse(url.strip())
    match = re.search(r"/projects/([^/]+)", parsed.path)
    if not (parsed.scheme and parsed.netloc and match):
        raise ZebrunnerError(f"Not a Zebrunner project URL: {url}")
    query = parse_qs(parsed.query)

    def number(name):
        return int(query[name][0]) if query.get(name, [""])[0].isdigit() else None

    return ZebrunnerUrl(f"{parsed.scheme}://{parsed.netloc}", match.group(1), number("suiteId"), number("caseId"))


def build_tree(suites, root_id, with_children=True):
    """Flat suites (parentSuiteId) -> [{id, parent, title}], parents before children.

    root_id=None means every suite. Otherwise: ancestors of root, root, and (optionally)
    all its descendants.
    """
    by_id = {s["id"]: s for s in suites}
    by_parent = {}
    for suite in suites:
        by_parent.setdefault(suite.get("parentSuiteId"), []).append(suite)

    def node(suite, parent):
        return {"id": suite["id"], "parent": parent, "title": suite["title"]}

    result = []
    if root_id is None:
        queue = [(s, None) for s in by_parent.get(None, [])]
    else:
        if root_id not in by_id:
            raise ZebrunnerError(f"Suite {root_id} not found in project")
        chain, current = [], by_id[root_id]
        while current:
            chain.append(current)
            current = by_id.get(current.get("parentSuiteId"))
        chain.reverse()
        result = [node(s, chain[i - 1]["id"] if i else None) for i, s in enumerate(chain)]
        queue = [(c, root_id) for c in by_parent.get(root_id, [])] if with_children else []
    while queue:
        suite, parent = queue.pop(0)
        result.append(node(suite, parent))
        queue.extend((c, suite["id"]) for c in by_parent.get(suite["id"], []))
    return result


def to_pivot_case(item):
    return {
        "key": item["key"],
        "suite": item["testSuite"]["id"],
        "priority": (item.get("priority") or {}).get("name") or "Not set",
        "title": item["title"],
        "desc": item.get("description") or "",
        "pre": item.get("preConditions") or "",
        "post": item.get("postConditions") or "",
        "draft": bool(item.get("draft")),
        "steps": [[s.get("action") or "", s.get("expectedResult") or ""] for s in item.get("steps") or []],
    }


class _Session:
    """One MCP session to Zebrunner, with paging helper."""

    def __init__(self, session):
        self.s = session

    async def call(self, tool, **args):
        result = await self.s.call_tool(tool, args)
        text = result.content[0].text if result.content else ""
        if result.isError:
            raise ZebrunnerError(f"Zebrunner {tool}: {text[:300]}")
        try:
            return json.loads(text)
        except ValueError as exc:
            raise ZebrunnerError(f"Zebrunner {tool} returned non-JSON: {text[:200]}") from exc

    async def pages(self, tool, **args):
        token = None
        while True:
            extra = {"pageToken": token} if token else {}
            data = await self.call(tool, maxPageSize=PAGE_SIZE, **args, **extra)
            for item in data.get("items", []):
                yield item
            token = (data.get("_meta") or {}).get("nextPageToken")
            if not token:
                return


def _explain(exc):
    """Unwrap exception groups from the MCP client into one readable line."""
    while getattr(exc, "exceptions", None):
        exc = exc.exceptions[0]
    text = str(exc) or exc.__class__.__name__
    if "401" in text or "403" in text:
        text += " (check X-Zebrunner-Username / X-Zebrunner-Api-Token: an API token, not the password)"
    return text


async def count_suites(base_url, username, token, project):
    endpoint = base_url.rstrip("/") + "/api/mcp"
    headers = {"X-Zebrunner-Username": username, "X-Zebrunner-Api-Token": token}
    try:
        async with streamablehttp_client(endpoint, headers=headers) as (read, write, _), ClientSession(read, write) as s:
            await s.initialize()
            return len([x async for x in _Session(s).pages("list_test_suites", projectKey=project)])
    except ZebrunnerError:
        raise
    except Exception as exc:
        raise ZebrunnerError(_explain(exc)) from exc


async def fetch_pivot(base_url, username, token, url: ZebrunnerUrl):
    try:
        return await _fetch_pivot(base_url, username, token, url)
    except ZebrunnerError:
        raise
    except Exception as exc:
        raise ZebrunnerError(_explain(exc)) from exc


async def _fetch_pivot(base_url, username, token, url: ZebrunnerUrl):
    endpoint = base_url.rstrip("/") + "/api/mcp"
    headers = {"X-Zebrunner-Username": username, "X-Zebrunner-Api-Token": token}
    project = url.project
    async with streamablehttp_client(endpoint, headers=headers) as (read, write, _), ClientSession(read, write) as session:
        await session.initialize()
        z = _Session(session)
        suites = [s async for s in z.pages("list_test_suites", projectKey=project)]
        if url.case_id is not None:
            items = [
                i
                async for i in z.pages(
                    "list_test_cases", projectKey=project, filter=f"id = {url.case_id}", includeFields="steps"
                )
            ]
            if not items:
                raise ZebrunnerError(f"Test case {url.case_id} not found in {project}")
            tree = build_tree(suites, items[0]["testSuite"]["id"], with_children=False)
        else:
            tree = build_tree(suites, url.suite_id)
            items = []
            ids = [s["id"] for s in tree]
            for start in range(0, len(ids), SUITE_IDS_PER_REQUEST):
                chunk = ",".join(str(x) for x in ids[start : start + SUITE_IDS_PER_REQUEST])
                items += [
                    c
                    async for c in z.pages(
                        "list_test_cases",
                        projectKey=project,
                        filter=f"testSuite.id IN ({chunk})",
                        includeFields="steps",
                    )
                ]
    cases = [to_pivot_case(i) for i in items if not i.get("deleted")]
    return {"product": project, "suites": tree, "cases": cases}
