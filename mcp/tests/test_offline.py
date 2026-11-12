import asyncio
import json
import socket
import threading
import time

import pytest

from kaspin_kiwi_mcp import config, jobs, server, uploads
from kaspin_kiwi_mcp.formats import FormatError, cases_to_pivot, read_pivot, rows_to_pivot, write_pivot
from kaspin_kiwi_mcp.importer import case_text, import_pivot, new_report
from kaspin_kiwi_mcp.zebrunner import (
    ZebrunnerError,
    ZebrunnerUrl,
    _explain,
    build_tree,
    fetch_pivot,
    parse_url,
)

PIVOT = {
    "product": "KPPOS",
    "suites": [
        {"id": 877, "parent": None, "title": "Owner"},
        {"id": 86, "parent": 877, "title": "Login"},
    ],
    "cases": [
        {"key": "KPPOS-1", "suite": 86, "priority": "High", "title": "Login ok",
         "desc": "d", "pre": "", "post": "", "draft": False,
         "steps": [["buka app", ""], ["klik login", "masuk"]]},
        {"key": "KPPOS-2", "suite": 877, "priority": "Low", "title": "Draft case",
         "desc": "", "pre": "", "post": "", "draft": True, "steps": []},
    ],
}  # fmt: skip


# ---------------------------------------------------------------- file formats


@pytest.mark.parametrize("ext", ["json", "csv", "xlsx"])
def test_roundtrip(tmp_path, ext):
    path = write_pivot(PIVOT, tmp_path / f"out.{ext}")
    back = read_pivot(path, "KPPOS")
    assert [c["key"] for c in back["cases"]] == ["KPPOS-1", "KPPOS-2"]
    assert back["cases"][0]["steps"] == [["buka app", ""], ["klik login", "masuk"]]
    assert back["cases"][1]["draft"] is True and back["cases"][1]["steps"] == []
    titles = {s["id"]: s["title"] for s in back["suites"]}
    parents = {s["title"]: s["parent"] for s in back["suites"]}
    assert titles[back["cases"][0]["suite"]] == "Login"
    assert parents["Owner"] is None and titles[parents["Login"]] == "Owner"


def test_flat_file_needs_product_and_key(tmp_path):
    path = write_pivot(PIVOT, tmp_path / "a.csv")
    with pytest.raises(FormatError):
        read_pivot(path)
    (tmp_path / "b.csv").write_text("key,suite_path,title\n,A,t\n")
    with pytest.raises(FormatError, match="key"):
        read_pivot(tmp_path / "b.csv", "P")


def test_json_list_of_cases_and_override(tmp_path):
    cases = [{"key": "A-1", "suite_path": "X > Y", "title": "t", "steps": [{"action": "a", "expected": "e"}]}]
    path = tmp_path / "list.json"
    path.write_text(json.dumps(cases))
    pivot = read_pivot(path, "PROD")
    assert pivot["cases"][0]["steps"] == [["a", "e"]] and len(pivot["suites"]) == 2
    with pytest.raises(FormatError):
        read_pivot(path)  # a list has no product of its own
    (tmp_path / "p.json").write_text(json.dumps(PIVOT))
    assert read_pivot(tmp_path / "p.json", "OTHER")["product"] == "OTHER"
    (tmp_path / "bad.json").write_text('{"x": 1}')
    with pytest.raises(FormatError):
        read_pivot(tmp_path / "bad.json", "P")


def test_cases_to_pivot_validation():
    good = {"key": "K-1", "suite_path": "A", "title": "t"}
    with pytest.raises(FormatError, match="Case 2.*duplicate"):
        cases_to_pivot([good, good], "P")
    with pytest.raises(FormatError, match="suite_path"):
        cases_to_pivot([{"key": "K", "title": "t"}], "P")
    out = cases_to_pivot([{**good, "draft": "yes", "steps": [["a", ""], ["", ""]]}], "P")
    assert out["cases"][0]["draft"] is True and out["cases"][0]["steps"] == [["a", ""]]


# ------------------------------------------------------------------ zebrunner


def test_parse_url():
    url = "https://x.zebrunner.com/projects/KPWEB2/test-cases?suiteId=1616"
    assert parse_url(url) == ZebrunnerUrl("https://x.zebrunner.com", "KPWEB2", 1616, None)
    assert parse_url("https://x.zebrunner.com/projects/KPPOS/test-cases?caseId=898").case_id == 898
    assert parse_url("https://x.zebrunner.com/projects/KPWEB2/test-cases").suite_id is None
    with pytest.raises(ZebrunnerError):
        parse_url("https://x.zebrunner.com/nothing")


FLAT = [
    {"id": 1, "parentSuiteId": None, "title": "A"},
    {"id": 2, "parentSuiteId": 1, "title": "B"},
    {"id": 3, "parentSuiteId": 2, "title": "C"},
    {"id": 4, "parentSuiteId": 1, "title": "D"},
    {"id": 9, "parentSuiteId": None, "title": "other"},
]


def test_build_tree_keeps_ancestors_and_children():
    tree = build_tree(FLAT, 2)
    assert tree == [
        {"id": 1, "parent": None, "title": "A"},
        {"id": 2, "parent": 1, "title": "B"},
        {"id": 3, "parent": 2, "title": "C"},
    ]
    assert build_tree(FLAT, 3, with_children=False)[-1] == {"id": 3, "parent": 2, "title": "C"}
    # scope for importing cases: the suite and its children, never its ancestors
    assert [s["id"] for s in build_tree(FLAT, 2, with_ancestors=False)] == [2, 3]
    assert build_tree(FLAT, 2, with_ancestors=False)[0]["parent"] is None
    assert {s["id"] for s in build_tree(FLAT, None)} == {1, 2, 3, 4, 9}
    with pytest.raises(ZebrunnerError):
        build_tree(FLAT, 77)


def test_zebrunner_host_is_locked(monkeypatch):
    monkeypatch.setenv("ZEBRUNNER_URL", "https://good.zebrunner.com")
    assert config.check_zebrunner_host("https://good.zebrunner.com") == "https://good.zebrunner.com"
    with pytest.raises(config.ConfigError):
        config.check_zebrunner_host("https://evil.example.com")
    monkeypatch.delenv("ZEBRUNNER_URL")
    assert config.check_zebrunner_host("https://any.zebrunner.com")
    with pytest.raises(config.ConfigError):
        config.check_zebrunner_host("https://evil.example.com")


def test_explain_hints_on_auth_failure():
    class Group(Exception):
        exceptions = [RuntimeError("Client error '401 Unauthorized' for url")]

    assert "API token" in _explain(Group())


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _zcase(key, suite, deleted=False):
    return {"id": 1, "key": key, "title": key, "testSuite": {"id": suite}, "deleted": deleted,
            "priority": {"name": "High"}, "draft": False, "description": None,
            "preConditions": None, "postConditions": None,
            "steps": [{"action": "do", "expectedResult": "see", "attachments": []}]}  # fmt: skip


@pytest.fixture
def fake_zebrunner():
    """A real Streamable HTTP MCP server that behaves like Zebrunner's /api/mcp."""
    import uvicorn
    from mcp.server.fastmcp import Context, FastMCP
    from mcp.server.transport_security import TransportSecuritySettings

    seen = {"headers": [], "filters": []}
    fake = FastMCP(
        "fake-zebrunner",
        stateless_http=True,
        json_response=True,
        streamable_http_path="/api/mcp",
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )

    @fake.tool()
    def list_test_suites(ctx: Context, projectKey: str, maxPageSize: int = 10, pageToken: str = "") -> str:
        h = ctx.request_context.request.headers
        seen["headers"].append((h.get("x-zebrunner-username"), h.get("x-zebrunner-api-token")))
        return json.dumps({"items": FLAT, "_meta": {}})

    cases = [_zcase("K-ANC", 1), _zcase("K-1", 2), _zcase("K-X", 2, deleted=True), _zcase("K-2", 3)]

    @fake.tool()
    def list_test_cases(projectKey: str, filter: str = "", includeFields: str = "", maxPageSize: int = 10,
                        pageToken: str = "") -> str:  # fmt: skip
        seen["filters"].append((filter, includeFields))
        if filter == "id = 898":
            return json.dumps({"items": [_zcase("K-898", 3)], "_meta": {}})
        ids = {int(x) for x in filter[filter.index("(") + 1 : -1].split(",")}
        matched = [c for c in cases if c["testSuite"]["id"] in ids]
        start = int(pageToken or 0)  # the fake pages one item at a time to exercise paging
        meta = {"nextPageToken": str(start + 1)} if start + 1 < len(matched) else {}
        return json.dumps({"items": matched[start : start + 1], "_meta": meta})

    port = _free_port()
    srv = uvicorn.Server(uvicorn.Config(fake.streamable_http_app(), host="127.0.0.1", port=port, log_level="error"))
    thread = threading.Thread(target=srv.run, daemon=True)
    thread.start()
    for _ in range(100):
        if srv.started:
            break
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}", seen
    srv.should_exit = True
    thread.join(timeout=5)


def test_fetch_suite_over_http_sends_headers_pages_and_keeps_ancestors(fake_zebrunner):
    base, seen = fake_zebrunner
    pivot = asyncio.run(fetch_pivot(base, "shared-user", "my-token", ZebrunnerUrl(base, "K", 2, None)))
    # K-ANC sits in ancestor suite A: A stays as an empty plan, its case is not imported
    assert [c["key"] for c in pivot["cases"]] == ["K-1", "K-2"]  # deleted dropped, pages joined
    assert pivot["cases"][0]["steps"] == [["do", "see"]] and pivot["cases"][0]["priority"] == "High"
    assert [s["title"] for s in pivot["suites"]] == ["A", "B", "C"]  # ancestor A, suite B, child C
    assert seen["headers"][0] == ("shared-user", "my-token")
    assert seen["filters"][0] == ("testSuite.id IN (2,3)", "steps")  # not 1: that is the ancestor


def test_fetch_single_case_keeps_suite_chain(fake_zebrunner):
    base, _ = fake_zebrunner
    pivot = asyncio.run(fetch_pivot(base, "u", "t", ZebrunnerUrl(base, "K", None, 898)))
    assert [c["key"] for c in pivot["cases"]] == ["K-898"]
    assert [s["title"] for s in pivot["suites"]] == ["A", "B", "C"]  # chain to the case's suite only


def test_fetch_wrong_host_is_a_readable_error():
    with pytest.raises(ZebrunnerError):
        asyncio.run(fetch_pivot("http://127.0.0.1:9", "u", "t", ZebrunnerUrl("", "K", 1, None)))


# --------------------------------------------------------------------- import


class FakeKiwi:
    """Just enough of Kiwi's RPC to watch what the importer does."""

    def __init__(self):
        self.db = {
            "PlanType": [{"id": 1, "name": "Function"}],
            "TestCaseStatus": [{"id": 1, "name": "CONFIRMED"}, {"id": 2, "name": "PROPOSED"}],
            "Priority": [{"id": i, "value": f"P{i}"} for i in range(1, 6)],
            "Product": [], "Version": [], "TestPlan": [], "Category": [],
            "Classification": [], "TestCase": [],
        }  # fmt: skip
        self.writes = []
        self.n = 100

    def first(self, method, query):
        kind = method.split(".")[0]
        if kind == "TestCase":
            hits = [c for c in self.db["TestCase"] if c["tag"] == query["tag__name"]]
        else:
            hits = [r for r in self.db[kind] if all(r.get(k) == v for k, v in query.items())]
        return hits[0] if hits else None

    def call(self, method, *args):
        kind, action = method.split(".")
        self.writes.append((method, args))
        if action == "create":
            self.n += 1
            row = {"id": self.n, **args[0]}
            if kind == "TestCase":
                row["tag"] = None
            self.db[kind].append(row)
            if kind == "Product":  # real Kiwi adds this version itself
                self.db["Version"].append({"id": self.n + 500, "product": row["id"], "value": "unspecified"})
            return row
        if method == "TestCase.add_tag":
            next(c for c in self.db["TestCase"] if c["id"] == args[0])["tag"] = args[1]


def test_import_dry_run_writes_nothing():
    kiwi = FakeKiwi()
    report = import_pivot(kiwi, PIVOT, dry_run=True)
    assert kiwi.writes == []
    assert report["cases_new"] == ["KPPOS-1", "KPPOS-2"] and report["plans_new"] == 2


def test_import_creates_then_is_idempotent():
    kiwi = FakeKiwi()
    report = import_pivot(kiwi, PIVOT, dry_run=False)
    assert report["cases_new"] == ["KPPOS-1", "KPPOS-2"] and report["processed"] == report["total"] == 2
    methods = [m for m, _ in kiwi.writes]
    assert methods.count("TestCase.create") == 2 and methods.count("TestPlan.add_case") == 2
    by_summary = {c["summary"]: c for c in kiwi.db["TestCase"]}
    assert by_summary["Draft case"]["case_status"] == 2  # PROPOSED
    assert by_summary["Login ok"]["priority"] == 1  # High -> P1
    child = next(p for p in kiwi.db["TestPlan"] if p["name"] == "Login")
    assert child["parent"] == next(p["id"] for p in kiwi.db["TestPlan"] if p["name"] == "Owner")

    kiwi.writes.clear()
    again = import_pivot(kiwi, PIVOT, dry_run=False)
    assert again["cases_new"] == [] and again["cases_existing"] == ["KPPOS-1", "KPPOS-2"]
    assert [m for m, _ in kiwi.writes if m == "TestCase.create"] == []


def test_same_suite_title_under_different_parents_stays_separate():
    pivot = {
        "product": "P",
        "suites": [
            {"id": 1, "parent": None, "title": "Owner"},
            {"id": 2, "parent": None, "title": "Customer"},
            {"id": 3, "parent": 1, "title": "Login"},
            {"id": 4, "parent": 2, "title": "Login"},
        ],
        "cases": [
            {"key": "P-1", "suite": 3, "priority": "High", "title": "a", "steps": [["x", ""]]},
            {"key": "P-2", "suite": 4, "priority": "High", "title": "b", "steps": [["x", ""]]},
        ],
    }  # fmt: skip
    kiwi = FakeKiwi()
    import_pivot(kiwi, pivot, dry_run=False)
    assert [p["name"] for p in kiwi.db["TestPlan"]].count("Login") == 2


def test_case_text_matches_script_format():
    text = case_text(PIVOT["cases"][0])
    assert text.startswith("**Description**\n\nd\n\n**Actions**\n\n1. buka app\n2. klik login")
    assert "**Expected results**\n\n2. masuk" in text
    assert case_text(PIVOT["cases"][1]) == "(no steps)\n"


# ------------------------------------------------------- credentials, jobs, uploads


class _Ctx:
    def __init__(self, headers=None):
        class Req:
            pass

        self.request_context = type("RC", (), {"request": None})()
        if headers is not None:
            req = Req()
            req.headers = headers
            self.request_context.request = req


def test_credentials_from_headers_not_environment(monkeypatch):
    monkeypatch.setenv("KIWI_USERNAME", "env-user")
    creds = config.creds_from_context(_Ctx({"x-kiwi-username": "qa", "x-kiwi-password": "pw"}))
    assert creds.kiwi == ["qa", "pw"]  # hosted mode ignores server-side env identity
    with pytest.raises(config.ConfigError, match="x-zebrunner-api-token"):
        creds.zebrunner


def test_credentials_from_environment_in_stdio(monkeypatch):
    monkeypatch.setenv("KIWI_USERNAME", "u")
    monkeypatch.setenv("KIWI_PASSWORD", "p")
    assert config.creds_from_context(_Ctx(None)).kiwi == ["u", "p"]
    monkeypatch.delenv("KIWI_PASSWORD")
    with pytest.raises(config.ConfigError, match="KIWI_PASSWORD"):
        config.creds_from_context(_Ctx(None)).kiwi


def test_job_runs_in_background_and_is_private():
    pivot = {"product": "P", "suites": [], "cases": []}
    report = new_report(pivot, True)
    job_id = jobs.start("alice", report, lambda: report.update(processed=5))
    for _ in range(100):
        if jobs.get(job_id, "alice")["state"] != "running":
            break
        time.sleep(0.02)
    assert jobs.get(job_id, "alice")["state"] == "done" and report["processed"] == 5
    with pytest.raises(jobs.JobError):
        jobs.get(job_id, "mallory")

    def boom():
        raise RuntimeError("kiwi down")

    failed = jobs.start("alice", report, boom)
    time.sleep(0.2)
    assert jobs.get(failed, "alice")["state"] == "failed" and "kiwi down" in jobs.get(failed, "alice")["error"]


def test_upload_flow(tmp_path, monkeypatch):
    from starlette.applications import Starlette
    from starlette.routing import Route
    from starlette.testclient import TestClient

    monkeypatch.setenv("MCP_UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(uploads, "_dir", None)
    client = TestClient(Starlette(routes=[Route("/up/{token}", uploads.handle, methods=["GET", "POST"])]))
    token = uploads.create("alice")
    assert client.get(f"/up/{token}").status_code == 200
    assert client.get("/up/not-a-real-token-at-all-xx").status_code == 404
    assert client.post(f"/up/{token}", content=b"x", headers={"X-Filename": "a.exe"}).status_code == 400
    assert client.post(f"/up/{token}", content=b"key,suite_path,title\n", headers={"X-Filename": "a.csv"}).status_code == 200
    assert client.post(f"/up/{token}", content=b"again", headers={"X-Filename": "a.csv"}).status_code == 409
    with pytest.raises(uploads.UploadError):
        uploads.take(token, "mallory")  # someone else's upload
    path, name = uploads.take(token, "alice")
    assert name == "a.csv" and path.read_bytes().startswith(b"key,suite_path")
    with pytest.raises(uploads.UploadError):
        uploads.take(token, "alice")  # one time only


def test_upload_size_limit(tmp_path, monkeypatch):
    from starlette.applications import Starlette
    from starlette.routing import Route
    from starlette.testclient import TestClient

    monkeypatch.setenv("MCP_UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(uploads, "_dir", None)
    monkeypatch.setattr(uploads, "MAX_BYTES", 10)
    client = TestClient(Starlette(routes=[Route("/up/{token}", uploads.handle, methods=["GET", "POST"])]))
    token = uploads.create("alice")
    assert client.post(f"/up/{token}", content=b"x" * 50, headers={"X-Filename": "a.csv"}).status_code == 413


# ------------------------------------------------------------------- tool surface


def test_hosted_server_has_no_file_path_tools():
    names = {t.name for t in asyncio.run(server.mcp.list_tools())}
    assert {"import_from_zebrunner", "import_cases", "create_upload_link", "get_import_status"} <= names
    assert not names & {"import_file", "zebrunner_backup"}  # would read/write the server's disk


def test_print_config_uses_absolute_python(capsys):
    import sys

    server.main(["--print-config"])
    cfg = json.loads(capsys.readouterr().out)["mcpServers"]["kaspin-kiwi"]
    assert cfg["command"] == sys.executable and cfg["args"] == ["-m", "kaspin_kiwi_mcp"]
    assert "KIWI_PASSWORD" in cfg["env"] and "ZEBRUNNER_API_TOKEN" in cfg["env"]
