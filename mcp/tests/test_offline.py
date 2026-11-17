import asyncio
import csv
import io
import json
import socket
import threading
import time
from pathlib import Path

import pytest

from kaspin_kiwi_mcp import server
from kaspin_kiwi_mcp.core import config, jobs
from kaspin_kiwi_mcp.backup_test_case import uploads
from kaspin_kiwi_mcp.backup_test_case.formats import FormatError, cases_to_pivot, read_pivot, rows_to_pivot, write_pivot
from kaspin_kiwi_mcp.backup_test_case.formats import (
    CREATE_COLUMNS, CREATE_EXTRA_COLUMNS, CREATE_FORMAT_HELP, csv_text_to_rows, group_create_rows,
)
from kaspin_kiwi_mcp.backup_test_case.importer import case_text, import_pivot, new_report
from kaspin_kiwi_mcp.backup_test_case.zebrunner import (
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
        self.reads = []
        self.n = 100

    def first(self, method, query):
        self.reads.append((method, query))
        kind = method.split(".")[0]
        if kind == "TestCase":
            if "tag__name" in query:
                hits = [c for c in self.db["TestCase"] if c["tag"] == query["tag__name"]]
            else:
                hits = [c for c in self.db["TestCase"] if query["plan"] in c.get("plans", [])
                        and c["summary"].casefold() == query["summary__iexact"].casefold()]
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
                row["plans"] = []
            self.db[kind].append(row)
            if kind == "Product":  # real Kiwi adds this version itself
                self.db["Version"].append({"id": self.n + 500, "product": row["id"], "value": "unspecified"})
            return row
        if method == "TestCase.add_tag":
            next(c for c in self.db["TestCase"] if c["id"] == args[0])["tag"] = args[1]
        if method == "TestPlan.add_case":
            next(c for c in self.db["TestCase"] if c["id"] == args[1])["plans"].append(args[0])


def test_import_dry_run_writes_nothing():
    kiwi = FakeKiwi()
    report = import_pivot(kiwi, PIVOT, dry_run=True)
    assert kiwi.writes == []
    assert report["cases_new"] == ["KPPOS-1", "KPPOS-2"] and report["plans_new"] == 2


def test_dry_run_warns_when_product_would_be_created():
    from kaspin_kiwi_mcp.backup_test_case.importer import format_report

    kiwi = FakeKiwi()
    report = import_pivot(kiwi, PIVOT, dry_run=True)
    assert report["product_new"] is True
    assert "WARNING: product 'KPPOS' does not exist" in format_report(report) and "will be CREATED" in format_report(report)
    real = import_pivot(kiwi, PIVOT, dry_run=False)
    assert "was CREATED" in format_report(real)
    again = import_pivot(kiwi, PIVOT, dry_run=True)  # product exists now: no warning
    assert again["product_new"] is False and "WARNING" not in format_report(again)


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
    assert {"import_from_zebrunner", "import_cases", "import_csv_text", "get_import_status"} <= names
    assert not names & {"import_file", "zebrunner_backup"}  # would read/write the server's disk
    # upload links add a public URL, so they exist only when MCP_ENABLE_UPLOAD is set
    assert not names & {"create_upload_link", "import_uploaded_file"}
    assert [r.path for r in server.mcp._custom_starlette_routes] == ["/mcp/health"]


def test_upload_tools_and_route_register_only_on_request():
    from mcp.server.fastmcp import FastMCP

    app = FastMCP("t")
    server._register_upload(app)
    assert {"create_upload_link", "import_uploaded_file"} <= {t.name for t in asyncio.run(app.list_tools())}
    assert [r.path for r in app._custom_starlette_routes] == ["/mcp/upload/{token}"]


def test_server_says_it_imports_into_kiwi_and_never_runs_tests():
    # clients confused "dry run" with a test execution and picked the Zebrunner MCP instead
    text = server.mcp.instructions
    assert "INTO Kiwi" in text and "never runs tests" in text and "dry run" in text
    desc = {t.name: t.description for t in asyncio.run(server.mcp.list_tools())}["import_from_zebrunner"]
    assert "INTO Kiwi" in desc and "NOT a test execution" in desc


def test_print_config_uses_absolute_python(capsys):
    import sys

    server.main(["--print-config"])
    cfg = json.loads(capsys.readouterr().out)["mcpServers"]["kaspin-kiwi"]
    assert cfg["command"] == sys.executable and cfg["args"] == ["-m", "kaspin_kiwi_mcp"]
    assert "KIWI_PASSWORD" in cfg["env"] and "ZEBRUNNER_API_TOKEN" in cfg["env"]


# --------------------------------------------------------- search / create cases


@pytest.mark.parametrize("key", [None, "", "   "])
def test_cases_to_pivot_optional_key(key):
    case = {"suite_path": "Owner > Login", "title": "Login ok"}
    if key is not None:
        case["key"] = key
    assert cases_to_pivot([case], "P", require_key=False)["cases"][0]["key"] is None
    with pytest.raises(FormatError) as exc:
        cases_to_pivot([case], "P")
    assert str(exc.value) == "Case 1: 'key' is required (used to avoid duplicates)"


def test_cases_to_pivot_optional_key_duplicates():
    case = {"suite_path": "Owner > Login", "title": "Login ok"}
    duplicate = {"suite_path": " owner  >  LOGIN ", "title": " LOGIN OK "}
    with pytest.raises(FormatError) as exc:
        cases_to_pivot([case, duplicate], "P", require_key=False)
    assert str(exc.value) == "Case 2: duplicate case ' LOGIN OK ' in  owner  >  LOGIN "
    keyed = {**case, "key": "P-1"}
    with pytest.raises(FormatError) as exc:
        cases_to_pivot([keyed, keyed], "P", require_key=False)
    assert str(exc.value) == "Case 2: duplicate key P-1"
    pivot = cases_to_pivot([case, {**case, "suite_path": "Other"}, keyed], "P", require_key=False)
    assert len(pivot["cases"]) == 3


@pytest.mark.parametrize("missing", ["title", "suite_path"])
def test_cases_to_pivot_optional_key_still_requires_fields(missing):
    case = {"suite_path": "Login", "title": "Login ok"}
    del case[missing]
    with pytest.raises(FormatError) as exc:
        cases_to_pivot([case], "P", require_key=False)
    assert str(exc.value) == "Case 1: title and suite_path are required"
    with pytest.raises(FormatError) as exc:
        cases_to_pivot([{**case, "key": "P-1"}], "P", require_key=False)
    assert str(exc.value) == "Case 1 (P-1): title and suite_path are required"


def test_import_keyless_dry_run_create_and_dedupe():
    kiwi = FakeKiwi()
    kiwi.db["Product"].append({"id": 10, "name": "P"})
    pivot = cases_to_pivot([
        {"suite_path": "Owner > Login", "title": "Login ok", "draft": True, "priority": "High",
         "steps": [{"action": "Open", "expected": "Home"}]},
        {"suite_path": "Owner > Login", "title": "Tagged", "key": "P-1"},
    ], "P", require_key=False)
    options = {"create_product": False, "plan_text": "Created with kaspin-kiwi MCP"}
    preview = import_pivot(kiwi, pivot, **options)
    assert kiwi.writes == [] and preview["cases_new"] == ["Login ok", "P-1"]
    report = import_pivot(kiwi, pivot, dry_run=False, **options)
    assert report["cases_new"] == ["Login ok", "P-1"]
    keyless, keyed = kiwi.db["TestCase"]
    assert keyless["case_status"] == 2 and keyless["tag"] is None and keyless["priority"] == 1
    assert keyless["text"] == "**Actions**\n\nOpen\n\n**Expected results**\n\nHome\n"
    assert keyed["tag"] == "P-1"
    assert [args for method, args in kiwi.writes if method == "TestCase.add_tag"] == [(keyed["id"], "P-1")]
    assert [args for method, args in kiwi.writes if method == "TestPlan.add_case"] == [
        (kiwi.db["TestPlan"][-1]["id"], keyless["id"]),
        (kiwi.db["TestPlan"][-1]["id"], keyed["id"]),
    ]
    assert all(plan["text"] == "Created with kaspin-kiwi MCP" for plan in kiwi.db["TestPlan"])
    kiwi.writes.clear()
    pivot["cases"][0]["title"] = "LOGIN OK"
    again = import_pivot(kiwi, pivot, dry_run=False, **options)
    assert again["cases_new"] == [] and again["cases_existing"] == ["LOGIN OK", "P-1"]
    assert kiwi.writes == []
    assert ("TestCase.filter", {"plan": keyless["plans"][0], "summary__iexact": "LOGIN OK"}) in kiwi.reads
    assert ("TestCase.filter", {"tag__name": "P-1", "category__product": 10}) in kiwi.reads


def test_import_keyless_same_title_in_separate_plans():
    kiwi = FakeKiwi()
    kiwi.db["Product"].append({"id": 10, "name": "P"})
    for suite_path in ("Owner > Login", "Admin > Login"):
        pivot = cases_to_pivot([{"suite_path": suite_path, "title": "Login ok"}], "P", require_key=False)
        report = import_pivot(kiwi, pivot, dry_run=False, create_product=False)
        assert report["cases_new"] == ["Login ok"] and report["cases_existing"] == []
    assert len(kiwi.db["TestCase"]) == 2 and len(kiwi.db["Category"]) == 1
    first, second = kiwi.db["TestCase"]
    assert first["plans"] != second["plans"]
    assert [args for method, args in kiwi.writes if method == "TestPlan.add_case"] == [
        (first["plans"][0], first["id"]), (second["plans"][0], second["id"]),
    ]


@pytest.mark.parametrize("title, existing", [("Login ok", True), ("LOGIN OK", True), ("Login  ok", False)])
def test_import_keyless_same_plan_title_match(title, existing):
    kiwi = FakeKiwi()
    kiwi.db["Product"].append({"id": 10, "name": "P"})
    case = {"suite_path": "Owner > Login", "title": "Login ok"}
    import_pivot(kiwi, cases_to_pivot([case], "P", require_key=False), dry_run=False, create_product=False)
    kiwi.writes.clear()
    pivot = cases_to_pivot([{**case, "title": title}], "P", require_key=False)
    report = import_pivot(kiwi, pivot, dry_run=False, create_product=False)
    assert report["cases_existing"] == ([title] if existing else [])
    assert report["cases_new"] == ([] if existing else [title])
    assert len(kiwi.db["TestCase"]) == (1 if existing else 2)
    if existing:
        assert kiwi.writes == []


@pytest.mark.parametrize("suite_path, existing", [("Owner > Login", True), ("Admin > Login", False)])
def test_import_keyless_dry_run_scoped_to_plan(suite_path, existing):
    kiwi = FakeKiwi()
    kiwi.db["Product"].append({"id": 10, "name": "P"})
    case = {"suite_path": "Owner > Login", "title": "Login ok"}
    import_pivot(kiwi, cases_to_pivot([case], "P", require_key=False), dry_run=False, create_product=False)
    kiwi.writes.clear()
    kiwi.reads.clear()
    pivot = cases_to_pivot([{**case, "suite_path": suite_path}], "P", require_key=False)
    report = import_pivot(kiwi, pivot, dry_run=True, create_product=False)
    assert report["cases_existing"] == (["Login ok"] if existing else [])
    assert report["cases_new"] == ([] if existing else ["Login ok"])
    assert kiwi.writes == []
    assert not any(method == "Category.filter" for method, _ in kiwi.reads)
    if not existing:
        assert not any(method == "TestCase.filter" for method, _ in kiwi.reads)


def test_import_keyless_missing_product_and_blank_key():
    kiwi = FakeKiwi()
    pivot = cases_to_pivot([{"suite_path": "Login", "title": "Login ok"}], "P", require_key=False)
    pivot["cases"][0]["key"] = ""
    assert import_pivot(kiwi, pivot)["cases_new"] == ["Login ok"]
    assert kiwi.writes == []
    import_pivot(kiwi, pivot, dry_run=False)
    assert not any(method == "TestCase.add_tag" for method, _ in kiwi.writes)


@pytest.mark.parametrize("dry_run", [True, False])
def test_import_never_creates_unknown_product(dry_run):
    kiwi = FakeKiwi()
    with pytest.raises(RuntimeError) as exc:
        import_pivot(kiwi, PIVOT, dry_run=dry_run, create_product=False)
    assert str(exc.value) == (
        "Product 'KPPOS' does not exist in Kiwi; this tool never creates products. Check the spelling."
    )
    assert kiwi.writes == []


def test_import_plan_text_title_format():
    kiwi = FakeKiwi()
    import_pivot(kiwi, PIVOT, dry_run=False, plan_text="Created: {title}")
    assert [plan["text"] for plan in kiwi.db["TestPlan"]] == ["Created: Owner", "Created: Login"]


@pytest.fixture
def tool_kiwi(monkeypatch):
    from kaspin_kiwi_mcp.backup_test_case import tools as backup
    from kaspin_kiwi_mcp.create_test_case import tools as create
    from kaspin_kiwi_mcp.search_test_case import tools as search

    kiwi = FakeKiwi()
    kiwi.db["Product"].append({"id": 10, "name": "P"})

    async def login(creds):
        assert creds.kiwi == ["qa", "pw"]
        return kiwi

    for module in (backup, create, search):
        monkeypatch.setattr(module, "_login", login)
    return kiwi, _Ctx({"x-kiwi-username": "qa", "x-kiwi-password": "pw"})


@pytest.mark.parametrize("filtered", [False, True])
def test_search_filters_output_and_truncation(tool_kiwi, monkeypatch, filtered):
    from kaspin_kiwi_mcp.search_test_case.tools import search_test_case

    kiwi, ctx = tool_kiwi
    rows = [
        {"id": n, "case_status__name": "PROPOSED", "priority__value": "P1",
         "category__name": "Login", "summary": f"Login {n}", "text": "Never print body"}
        for n in (3, 1, 2)
    ]
    calls = []

    def call(method, query):
        calls.append((method, query))
        return rows

    monkeypatch.setattr(kiwi, "call", call)
    kwargs = dict(query="Login", category="Login", key="P-1", status="PROPOSED", limit=2) if filtered else {}
    text = asyncio.run(search_test_case(ctx, "P", **kwargs))
    expected = {"category__product": 10}
    if filtered:
        expected.update(summary__icontains="Login", category__name="Login", tag__name="P-1",
                        case_status__name="PROPOSED")
    assert calls == [("TestCase.filter", expected)]
    assert kiwi.reads == [("Product.filter", {"name": "P"})]
    first = "Found 3 case(s) in P" + (", showing the first 2" if filtered else "")
    count = 2 if filtered else 3
    assert text == "\n".join([first] + [f"#{n} [PROPOSED] [P1] Login | Login {n}" for n in range(1, count + 1)])
    assert kiwi.writes == []


@pytest.mark.parametrize("limit", [1, 100])
def test_search_no_matches_and_limit_endpoints(tool_kiwi, monkeypatch, limit):
    from kaspin_kiwi_mcp.search_test_case.tools import search_test_case

    kiwi, ctx = tool_kiwi
    monkeypatch.setattr(kiwi, "call", lambda *args: [])
    assert asyncio.run(search_test_case(ctx, "P", limit=limit)) == "Found 0 case(s) in P"
    assert kiwi.writes == []


def test_search_unknown_product(tool_kiwi):
    from kaspin_kiwi_mcp.search_test_case.tools import search_test_case

    kiwi, ctx = tool_kiwi
    with pytest.raises(ValueError) as exc:
        asyncio.run(search_test_case(ctx, "Typo"))
    assert str(exc.value) == "Product 'Typo' does not exist in Kiwi."
    assert kiwi.writes == []


@pytest.mark.parametrize("limit", [0, -1, 101])
def test_search_invalid_limit(tool_kiwi, limit):
    from kaspin_kiwi_mcp.search_test_case.tools import search_test_case

    kiwi, ctx = tool_kiwi
    with pytest.raises(ValueError, match="^limit must be between 1 and 100$"):
        asyncio.run(search_test_case(ctx, "P", limit=limit))
    assert kiwi.reads == [] and kiwi.writes == []


def test_create_defaults_drafts_and_preserves_explicit_false(tool_kiwi):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case

    kiwi, ctx = tool_kiwi
    cases = [{"suite_path": "Login", "title": "Draft"},
             {"suite_path": "Login", "title": "Ready", "draft": False}]
    preview = asyncio.run(create_test_case(ctx, "P", cases))
    assert "DRY RUN (nothing written)" in preview and "cases to create: 2" in preview
    assert kiwi.writes == [] and "draft" not in cases[0]
    report = asyncio.run(create_test_case(ctx, "P", cases, dry_run=False))
    assert "cases created: 2" in report
    assert [case["case_status"] for case in kiwi.db["TestCase"]] == [2, 1]
    assert kiwi.db["TestPlan"][0]["text"] == "Created with kaspin-kiwi MCP"
    assert not any(method in ("Product.create", "TestCase.add_tag") for method, _ in kiwi.writes)


@pytest.mark.parametrize("draft, status", [(None, 2), ("", 2), (False, 1), ("no", 1), ("false", 1)])
def test_create_null_blank_and_explicit_false_drafts(tool_kiwi, draft, status):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case

    kiwi, ctx = tool_kiwi
    case = {"suite_path": "Login", "title": "Login ok", "draft": draft}
    asyncio.run(create_test_case(ctx, "P", [case], dry_run=False))
    assert kiwi.db["TestCase"][0]["case_status"] == status
    assert case["draft"] == draft


def test_create_rejects_over_inline_limit(tool_kiwi):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case

    kiwi, ctx = tool_kiwi
    with pytest.raises(ValueError) as exc:
        asyncio.run(create_test_case(ctx, "P", [{}] * 101))
    assert str(exc.value) == "Send at most 100 cases per call (got 101); split them into batches."
    assert kiwi.reads == [] and kiwi.writes == []


@pytest.mark.parametrize("dry_run", [True, False])
def test_create_unknown_product_precheck(tool_kiwi, monkeypatch, dry_run):
    from kaspin_kiwi_mcp.create_test_case import tools

    kiwi, ctx = tool_kiwi

    async def unexpected_import(*args, **kwargs):
        pytest.fail("Unknown product must be rejected before import")

    monkeypatch.setattr(tools, "_run_import", unexpected_import)
    with pytest.raises(ValueError) as exc:
        asyncio.run(tools.create_test_case(ctx, "Typo", [{"suite_path": "Login", "title": "t"}], dry_run))
    assert str(exc.value) == (
        "Product 'Typo' does not exist in Kiwi; create_test_case never creates products. Check the spelling."
    )
    assert kiwi.reads == [("Product.filter", {"name": "Typo"})] and kiwi.writes == []


def test_create_background_forwards_import_options(tool_kiwi, monkeypatch):
    from kaspin_kiwi_mcp.backup_test_case import tools as backup
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case

    kiwi, ctx = tool_kiwi
    captured = []

    def start(owner, report, work):
        captured.append((owner, work))
        return "job-test"

    monkeypatch.setattr(backup.jobs, "start", start)
    cases = [{"suite_path": "Login", "title": f"Case {n}"} for n in range(100)]
    assert "job-test" in asyncio.run(create_test_case(ctx, "P", cases, dry_run=False))
    assert kiwi.writes == []
    owner, work = captured[0]
    assert owner == "qa"
    work()
    assert len(kiwi.db["TestCase"]) == 100
    assert kiwi.db["TestPlan"][0]["text"] == "Created with kaspin-kiwi MCP"
    assert all(case["case_status"] == 2 for case in kiwi.db["TestCase"])
    kiwi.db["Product"].clear()
    kiwi.writes.clear()
    with pytest.raises(RuntimeError, match="this tool never creates products"):
        work()
    assert kiwi.writes == []


def test_hosted_server_lists_search_and_create_with_old_tools():
    names = {t.name for t in asyncio.run(server.mcp.list_tools())}
    assert names == {"check_connection", "import_from_zebrunner", "get_file_format", "import_cases",
                     "import_csv_text", "get_import_status", "search_test_case", "create_test_case",
                     "create_test_case_csv", "get_create_format"}


# ---------------------------------------------------------- creation from tables


def _create_table_text(rows, columns=CREATE_COLUMNS, delimiter=","):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=columns, delimiter=delimiter, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


@pytest.mark.parametrize("suite_header", ["Suite Path", "SUITE--PATH", "suite__ path"])
def test_create_header_normalization(suite_header):
    text = f"\ufeff\n\n {suite_header} , TITLE ,Description,postconditions, STEP NO \n A > B , Case , before , after ,1\n"
    rows = csv_text_to_rows(text)
    assert list(rows[0]) == ["suite_path", "title", "description", "postconditions", "step_no"]


@pytest.mark.parametrize("delimiter", [",", ";", "\t"])
def test_create_delimiters_multiline_and_cell_whitespace(delimiter):
    rows = [{"suite_path": " A > B ", "title": " Case ", "description": " First line\nSecond line ",
             "action": " open, click; tab\tthen\nnext ", "expected": " Keep  inner spaces "}]
    text = _create_table_text(rows, delimiter=delimiter)
    cases = group_create_rows(csv_text_to_rows(text))
    assert cases == group_create_rows(csv_text_to_rows(_create_table_text(rows)))
    assert cases[0]["suite_path"] == "A > B" and cases[0]["title"] == "Case"
    assert cases[0]["description"] == "First line\nSecond line"
    assert cases[0]["steps"] == [{"action": "open, click; tab\tthen\nnext", "expected": "Keep  inner spaces"}]


@pytest.mark.parametrize("header", ["suite_path,title,unknown,judul", "suite_path,wrong", "title,wrong"])
def test_create_unknown_header_lists_accepted_columns(header):
    with pytest.raises(FormatError) as exc:
        csv_text_to_rows(header + "\n")
    assert "Unknown columns:" in str(exc.value)
    for unknown in ("wrong",) if "wrong" in header else ("unknown", "judul"):
        assert unknown in str(exc.value)
    for column in CREATE_COLUMNS + CREATE_EXTRA_COLUMNS:
        assert column in str(exc.value)


@pytest.mark.parametrize("missing", ["title", "suite_path"])
def test_create_missing_header_lists_accepted_columns(missing):
    columns = [c for c in CREATE_COLUMNS if c != missing]
    with pytest.raises(FormatError) as exc:
        csv_text_to_rows(",".join(columns) + "\n")
    assert f"Missing required columns: {missing}." in str(exc.value)
    assert ", ".join(CREATE_COLUMNS + CREATE_EXTRA_COLUMNS) in str(exc.value)


def test_create_duplicate_normalized_header():
    with pytest.raises(FormatError, match="Duplicate columns: suite_path"):
        csv_text_to_rows("suite_path,title,Suite-Path\n")


@pytest.mark.parametrize("text", ['suite_path,title,action\nA,Case,"unclosed', 'suite_path,title\nA,Case,extra'])
def test_create_malformed_csv_rejected(text):
    with pytest.raises(FormatError):
        csv_text_to_rows(text)


def test_group_create_rows_steps_blank_rows_and_optional_extras():
    rows = [
        {"suite_path": "A", "title": "First", "key": " K-1 ", "action": "one", "step_no": 99},
        {},
        {"action": "two", "expected": "result", "key": "K-1", "step_no": 1},
        {"expected": "three", "key": ""},
        {"suite_path": "A", "title": "Second"},
        {"title": None, "action": " "},
    ]
    cases = group_create_rows(rows)
    assert len(cases) == 2 and [len(c["steps"]) for c in cases] == [3, 0]
    assert cases[0]["key"] == "K-1" and "key" not in cases[1]
    assert cases[0]["steps"] == [
        {"action": "one", "expected": ""}, {"action": "two", "expected": "result"},
        {"action": "", "expected": "three"},
    ]


def test_group_create_step_before_case_row_number():
    rows = csv_text_to_rows("suite_path,title,action\n\n,,Open\n")
    with pytest.raises(FormatError) as exc:
        group_create_rows(rows)
    assert str(exc.value) == "Row 3: step row without a case; the first row of a case needs title and suite_path"


@pytest.mark.parametrize("field", ["suite_path", "priority", "draft", "description", "preconditions", "postconditions", "key"])
def test_group_create_continuation_rejects_case_cells(field):
    rows = [{"suite_path": "A", "title": "Case", "key": "K-1"}, {}, {"action": "Next", field: "different"}]
    with pytest.raises(FormatError) as exc:
        group_create_rows(rows)
    assert str(exc.value) == "Row 4: a step row (empty title) may only fill action and expected"


def test_group_create_first_row_requires_suite_path():
    with pytest.raises(FormatError) as exc:
        group_create_rows([{}, {"title": "Case"}])
    assert str(exc.value) == "Row 3: suite_path is required on the first row of a case"


@pytest.mark.parametrize("priority, normalized", [("high", "High"), (" NOT SET ", "Not set"), ("", "Not set"), (None, "Not set")])
def test_create_strict_priority_normalization(priority, normalized):
    pivot = cases_to_pivot([{"suite_path": "A", "title": "Case", "priority": priority}], "P",
                           require_key=False, strict_values=True)
    assert pivot["cases"][0]["priority"] == normalized and pivot["cases"][0]["draft"] is True


@pytest.mark.parametrize("draft, expected", [("", True), (None, True), ("YES", True), ("true", True),
                                           ("y", True), (1, True), ("no", False), ("FALSE", False),
                                           ("n", False), (0, False), (False, False)])
def test_create_strict_draft_values(draft, expected):
    pivot = cases_to_pivot([{"suite_path": "A", "title": "Case", "draft": draft}], "P",
                           require_key=False, strict_values=True)
    assert pivot["cases"][0]["draft"] is expected


@pytest.mark.parametrize("field, value, message", [
    ("priority", "urgent", "priority 'urgent' is not valid; use High, Medium, Low, Trivial or Not set"),
    ("draft", "tidak", "draft 'tidak' is not valid; use yes or no"),
])
def test_create_inline_strict_values_reach_caller(tool_kiwi, field, value, message):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case

    kiwi, ctx = tool_kiwi
    with pytest.raises(FormatError) as exc:
        asyncio.run(create_test_case(ctx, "P", [{"suite_path": "A", "title": "Case", field: value}]))
    assert str(exc.value) == f"Case 1 (Case): {message}"
    assert kiwi.reads == [] and kiwi.writes == []


def test_cases_to_pivot_default_values_remain_lenient():
    pivot = cases_to_pivot([{"key": "P-1", "suite_path": "A", "title": "Case", "priority": "urgent", "draft": "tidak"}], "P")
    assert pivot["cases"][0]["priority"] == "urgent" and pivot["cases"][0]["draft"] is False
    kiwi = FakeKiwi()
    import_pivot(kiwi, pivot, dry_run=False)
    assert kiwi.db["TestCase"][0]["priority"] == 3 and kiwi.db["TestCase"][0]["case_status"] == 1


@pytest.mark.parametrize("field, value", [("priority", "urgent"), ("draft", "tidak")])
def test_create_csv_strict_values_reach_caller(tool_kiwi, field, value):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case_csv

    kiwi, ctx = tool_kiwi
    text = _create_table_text([{"suite_path": "A", "title": "Case", field: value}])
    with pytest.raises(FormatError) as expected:
        cases_to_pivot(group_create_rows(csv_text_to_rows(text)), "P", require_key=False, strict_values=True)
    with pytest.raises(FormatError) as actual:
        asyncio.run(create_test_case_csv(ctx, "P", text))
    assert str(actual.value) == str(expected.value)
    assert kiwi.reads == [] and kiwi.writes == []


def test_create_csv_case_limit_after_grouping(tool_kiwi):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case_csv

    kiwi, ctx = tool_kiwi
    text = _create_table_text([{"suite_path": "A", "title": f"Case {n}"} for n in range(101)])
    with pytest.raises(ValueError) as exc:
        asyncio.run(create_test_case_csv(ctx, "P", text))
    assert str(exc.value) == "Send at most 100 cases per call (got 101); split them into batches."
    assert kiwi.reads == [] and kiwi.writes == []
    text = _create_table_text([{"suite_path": "A", "title": "Case"}] + [{"action": "Next"}] * 101)
    assert "cases to create: 1" in asyncio.run(create_test_case_csv(ctx, "P", text))
    assert kiwi.writes == []


def test_create_csv_text_limit_before_parsing(tool_kiwi, monkeypatch):
    from kaspin_kiwi_mcp.create_test_case import tools

    kiwi, ctx = tool_kiwi

    def unexpected_parse(*args):
        pytest.fail("Size limit must be checked before parsing")

    monkeypatch.setattr(tools, "csv_text_to_rows", unexpected_parse)
    with pytest.raises(ValueError) as exc:
        asyncio.run(tools.create_test_case_csv(ctx, "P", "x" * 1_000_001))
    assert str(exc.value) == "csv_text is too large (over 1,000,000 characters); split it into batches of up to 100 cases."
    assert kiwi.reads == [] and kiwi.writes == []


def test_create_csv_large_cell_within_limit(tool_kiwi):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case_csv

    _, ctx = tool_kiwi
    old_limit = csv.field_size_limit()
    text = _create_table_text([{"suite_path": "A", "title": "Case", "description": "x" * 200_000}])
    assert "cases to create: 1" in asyncio.run(create_test_case_csv(ctx, "P", text))
    assert csv.field_size_limit() == old_limit


def test_create_csv_end_to_end(tool_kiwi):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case_csv

    kiwi, ctx = tool_kiwi
    text = (Path(__file__).parents[1] / "examples/create-template.csv").read_text(encoding="utf-8")
    assert "cases to create: 2" in asyncio.run(create_test_case_csv(ctx, "P", text))
    assert kiwi.writes == []
    assert "cases created: 2" in asyncio.run(create_test_case_csv(ctx, "P", text, dry_run=False))
    assert [c["case_status"] for c in kiwi.db["TestCase"]] == [2, 2]
    assert not any(method == "TestCase.add_tag" for method, _ in kiwi.writes)
    cases = group_create_rows(csv_text_to_rows(text))
    for source, created in zip(cases, kiwi.db["TestCase"]):
        for step in source["steps"]:
            assert step["action"] in created["text"] and step["expected"] in created["text"]
    kiwi.writes.clear()
    report = asyncio.run(create_test_case_csv(ctx, "P", text, dry_run=False))
    assert "cases created: 0" in report and "cases already in Kiwi (skipped): 2" in report
    assert kiwi.writes == []


def test_create_csv_no_draft_means_proposed_and_no_means_confirmed(tool_kiwi):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case_csv

    kiwi, ctx = tool_kiwi
    text = "suite_path,title,draft\nA,Draft,\nA,Confirmed,no\n"
    asyncio.run(create_test_case_csv(ctx, "P", text, dry_run=False))
    assert [c["case_status"] for c in kiwi.db["TestCase"]] == [2, 1]
    assert all(c["text"] == "(no steps)\n" for c in kiwi.db["TestCase"])


@pytest.mark.parametrize("dry_run", [True, False])
def test_create_csv_unknown_product_no_writes(tool_kiwi, dry_run):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case_csv

    kiwi, ctx = tool_kiwi
    with pytest.raises(ValueError) as exc:
        asyncio.run(create_test_case_csv(ctx, "Typo", "suite_path,title\nA,Case\n", dry_run))
    assert str(exc.value) == "Product 'Typo' does not exist in Kiwi; create_test_case never creates products. Check the spelling."
    assert kiwi.writes == []


def test_get_create_format_and_registration():
    from mcp.server.fastmcp import FastMCP
    from kaspin_kiwi_mcp.create_test_case.tools import get_create_format, register

    assert get_create_format() == CREATE_FORMAT_HELP
    assert all(column in get_create_format() for column in CREATE_COLUMNS + CREATE_EXTRA_COLUMNS)
    assert "Google" in get_create_format() and "Excel" in get_create_format()
    app = FastMCP("creation")
    register(app)
    assert [tool.name for tool in asyncio.run(app.list_tools())] == [
        "create_test_case", "create_test_case_csv", "get_create_format",
    ]
    example = get_create_format().split("Example CSV", 1)[1].split("\n", 1)[1].split("\n\nHow to get the data:", 1)[0]
    assert len(example.splitlines()) == 6
    assert [len(c["steps"]) for c in group_create_rows(csv_text_to_rows(example))] == [3, 1]


def test_create_csv_and_xlsx_templates_match():
    from openpyxl import load_workbook

    examples = Path(__file__).parents[1] / "examples"
    raw = (examples / "create-template.csv").read_bytes()
    assert b"\r" not in raw and not raw.startswith(b"\xef\xbb\xbf")
    csv_cases = group_create_rows(csv_text_to_rows(raw.decode("utf-8")))
    book = load_workbook(examples / "create-template.xlsx", data_only=True)
    try:
        assert book.sheetnames == ["test_case", "Petunjuk"]
        sheet = book.worksheets[0]
        rows = sheet.iter_rows(values_only=True)
        header = list(next(rows))
        assert header == CREATE_COLUMNS
        normalized = [str(h).strip().casefold() for h in header]
        xlsx_cases = group_create_rows([dict(zip(normalized, row)) for row in rows])
        assert csv_cases == xlsx_cases and len(csv_cases) == 2
        assert [len(c["steps"]) for c in csv_cases] == [3, 1]
        pivot = cases_to_pivot(csv_cases, "P", require_key=False, strict_values=True)
        assert [c["draft"] for c in pivot["cases"]] == [True, True]
        assert sheet.freeze_panes == "A2" and all(cell.font.bold for cell in sheet[1])
        validations = sheet.data_validations.dataValidation
        assert len(validations) == 2
        assert {(str(v.sqref), v.type, v.formula1) for v in validations} == {
            ("C2:C1000", "list", '"High,Medium,Low,Trivial,Not set"'), ("D2:D1000", "list", '"yes,no"'),
        }
    finally:
        book.close()


# ---------------------------------------------------------- empty export columns


HEADERLESS_CREATE_CSV = (
    "suite_path,title,priority,draft,action,expected,,\n"
    "Owner > Login,Login ok,High,yes,Buka app,Form muncul,,\n"
    ",,,,Klik login,Home,,\n"
)


@pytest.mark.parametrize("suffix", [",,", ",Unnamed: 6,Unnamed: 7"])
def test_create_csv_empty_trailing_header_columns(suffix):
    text = HEADERLESS_CREATE_CSV.replace("expected,,\n", f"expected{suffix}\n", 1)
    rows = csv_text_to_rows(text)
    assert list(rows[0]) == ["suite_path", "title", "priority", "draft", "action", "expected"]
    cases = group_create_rows(rows)
    assert len(cases) == 1 and cases[0]["title"] == "Login ok"
    assert cases[0]["steps"] == [
        {"action": "Buka app", "expected": "Form muncul"}, {"action": "Klik login", "expected": "Home"},
    ]
    assert cases == group_create_rows(csv_text_to_rows(HEADERLESS_CREATE_CSV))


def test_create_csv_empty_middle_columns_and_short_rows():
    text = (
        "suite_path,,title,action,expected,Unnamed: 5\n"
        "Owner > Login,,Login ok,Buka app,Form muncul,\n"
        ",,,Klik login,Home\n"
    )
    rows = csv_text_to_rows(text)
    assert list(rows[0]) == ["suite_path", "title", "action", "expected"]
    cases = group_create_rows(rows)
    assert len(cases) == 1 and len(cases[0]["steps"]) == 2
    assert cases[0]["steps"][1] == {"action": "Klik login", "expected": "Home"}
    assert csv_text_to_rows("suite_path,title,,\nA,Case\n") == [{"suite_path": "A", "title": "Case"}]


@pytest.mark.parametrize("text, column", [
    (",suite_path,title\n0,A,Case\n1,,\n2,,\n", 1),
    ("suite_path,,title\nA,,Case\n,hidden,\n", 2),
    ("suite_path,title,Unnamed: 2\nA,Case,\n,,value\n", 3),
])
def test_create_csv_headerless_columns_with_values_rejected(text, column):
    with pytest.raises(FormatError) as exc:
        csv_text_to_rows(text)
    assert str(exc.value) == (
        f"Column {column} has values but no header name; send only the template columns (no row-index column)"
    )


@pytest.mark.parametrize("blank_row, number", [("", 2), ("\n", 3)])
def test_create_csv_extra_nonblank_cell_rejected(blank_row, number):
    with pytest.raises(FormatError) as exc:
        csv_text_to_rows(f"suite_path,title\n{blank_row}A,Case,,value\n")
    assert str(exc.value) == f"Row {number}: more cells than header columns"


def test_create_csv_extra_blank_cells_ignored():
    text = 'suite_path,title,action\nA,Case,Open,," \t "\n,,Next,,\n'
    cases = group_create_rows(csv_text_to_rows(text))
    assert len(cases) == 1 and cases[0]["steps"] == [
        {"action": "Open", "expected": ""}, {"action": "Next", "expected": ""},
    ]


@pytest.mark.parametrize("header", ["Unnamed Notes", "Unnamed: x", "Unnamed: 1x", "Unnamed: 2.1"])
def test_create_csv_unnamed_pattern_does_not_hide_unknown_columns(header):
    with pytest.raises(FormatError, match="Unknown columns:") as exc:
        csv_text_to_rows(f"suite_path,title,{header}\nA,Case,\n")
    assert header.casefold().replace(" ", "_") in str(exc.value)


@pytest.mark.parametrize("header, error", [
    ("suite_path,,title,,TITLE", "Duplicate columns: title."),
    ("suite_path,,,", "Missing required columns: title."),
    ("suite_path,title,,Unnamed Notes,", "Unknown columns: 'unnamed_notes'."),
])
def test_create_csv_validates_named_headers_after_dropping_empty_columns(header, error):
    with pytest.raises(FormatError) as exc:
        csv_text_to_rows(header + "\n")
    assert str(exc.value).startswith(error)


@pytest.mark.parametrize("suffix", [",,", ",Unnamed: 6,Unnamed: 7"])
def test_create_csv_headerless_export_end_to_end(tool_kiwi, suffix):
    from kaspin_kiwi_mcp.create_test_case.tools import create_test_case_csv

    kiwi, ctx = tool_kiwi
    text = HEADERLESS_CREATE_CSV.replace("expected,,\n", f"expected{suffix}\n", 1)
    assert "cases to create: 1" in asyncio.run(create_test_case_csv(ctx, "P", text))
    assert kiwi.writes == []
    assert "cases created: 1" in asyncio.run(create_test_case_csv(ctx, "P", text, dry_run=False))
    assert len(kiwi.db["TestCase"]) == 1
    case = kiwi.db["TestCase"][0]
    assert case["case_status"] == 2 and case["tag"] is None
    assert case["text"] == (
        "**Actions**\n\n1. Buka app\n2. Klik login\n\n**Expected results**\n\n1. Form muncul\n2. Home\n"
    )
