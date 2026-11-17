"""Read and write the pivot dict as JSON, CSV or XLSX.

Pivot shape (same as scripts/zebrunner_*_suite.json):
    {"product": "KPWEB2",
     "suites": [{"id": 1, "parent": null, "title": "Owner"}, ...],   # parents first
     "cases":  [{"key": "KPWEB2-1", "suite": 1, "priority": "High", "title": "...",
                 "desc": "", "pre": "", "post": "", "draft": false,
                 "steps": [["action", "expected"], ...]}, ...]}

CSV/XLSX are flat: one row per step, case columns repeated on the first row of a case.
"""
import csv
import io
import json
import pathlib
import re

COLUMNS = [
    "key", "suite_path", "title", "priority", "draft",
    "description", "preconditions", "postconditions",
    "step_no", "action", "expected",
]  # fmt: skip
PATH_SEP = " > "

CREATE_COLUMNS = [
    "suite_path", "title", "priority", "draft", "description",
    "preconditions", "postconditions", "action", "expected",
]
CREATE_EXTRA_COLUMNS = ["key", "step_no"]
CREATE_PRIORITIES = ("High", "Medium", "Low", "Trivial", "Not set")
CREATE_DRAFT_TRUE = frozenset(("yes", "true", "y", "1"))
CREATE_DRAFT_FALSE = frozenset(("no", "false", "n", "0"))


class FormatError(ValueError):
    pass


def csv_text_to_rows(csv_text):
    """Read the fixed creation table, retaining blank rows for spreadsheet row numbers."""
    lines = iter(csv_text.lstrip("\ufeff").splitlines(keepends=True))
    header_line = next((line for line in lines if line.strip()), "")
    counts = {d: header_line.count(d) for d in (",", ";", "\t")}
    winners = [d for d, count in counts.items() if count == max(counts.values())]
    delimiter = winners[0] if len(winners) == 1 else ","
    reader = csv.reader(io.StringIO(header_line + "".join(lines), newline=""), delimiter=delimiter, strict=True)
    accepted = CREATE_COLUMNS + CREATE_EXTRA_COLUMNS
    accepted_text = ", ".join(accepted)
    # Allow cells up to the tool's text limit without changing the backup parser's default limit.
    old_limit = csv.field_size_limit()
    try:
        csv.field_size_limit(max(old_limit, len(csv_text)))
        header = [re.sub(r"[\s_-]+", "_", h.strip().lstrip("\ufeff").strip().casefold())
                  for h in next(reader, [])]
        rows = []
        for number, values in enumerate(reader, 2):
            if any(value.strip() for value in values[len(header):]):
                raise FormatError(f"Row {number}: more cells than header columns")
            rows.append(values[:len(header)] + [""] * (len(header) - len(values)))
        columns = []
        for index, name in enumerate(header):
            if not name or re.fullmatch(r"unnamed:_\d+", name):
                if any(row[index].strip() for row in rows):
                    raise FormatError(
                        f"Column {index + 1} has values but no header name; "
                        "send only the template columns (no row-index column)"
                    )
            else:
                columns.append(index)
        names = [header[index] for index in columns]
        duplicates = sorted({h for h in names if names.count(h) > 1})
        if duplicates:
            raise FormatError(f"Duplicate columns: {', '.join(duplicates)}. Accepted columns: {accepted_text}")
        unknown = [h for h in names if h not in accepted]
        if unknown:
            raise FormatError(f"Unknown columns: {', '.join(repr(h) for h in unknown)}. Accepted columns: {accepted_text}")
        missing = [h for h in ("suite_path", "title") if h not in names]
        if missing:
            raise FormatError(f"Missing required columns: {', '.join(missing)}. Accepted columns: {accepted_text}")
        return [{header[index]: values[index] for index in columns} for values in rows]
    except csv.Error as exc:
        raise FormatError(f"Invalid CSV: {exc}") from exc
    finally:
        csv.field_size_limit(old_limit)


def group_create_rows(rows):
    """Group normalized table rows into cases; only a non-blank title starts a case."""
    cases = []
    for number, row in enumerate(rows, 2):
        row = {k: "" if v is None else str(v).strip() for k, v in row.items()}
        if not any(row.values()):
            continue
        if row.get("title"):
            if not row.get("suite_path"):
                raise FormatError(f"Row {number}: suite_path is required on the first row of a case")
            case = {k: row.get(k, "") for k in CREATE_COLUMNS if k not in ("action", "expected")}
            if "key" in row:
                case["key"] = row["key"]
            case["steps"] = []
            cases.append(case)
        else:
            if not cases:
                raise FormatError(
                    f"Row {number}: step row without a case; the first row of a case needs title and suite_path"
                )
            case = cases[-1]
            if (any(v for k, v in row.items() if k not in ("action", "expected", "step_no", "key"))
                    or row.get("key") and row["key"] != case.get("key", "")):
                raise FormatError(f"Row {number}: a step row (empty title) may only fill action and expected")
        action, expected = row.get("action", ""), row.get("expected", "")
        if action or expected:
            case["steps"].append({"action": action, "expected": expected})
    return cases


def _create_values(case, number):
    title = case["title"]
    value = "" if case.get("priority") is None else str(case["priority"]).strip()
    priority = next((p for p in CREATE_PRIORITIES if p.casefold() == value.casefold()), None)
    if not value:
        priority = "Not set"
    if priority is None:
        allowed = ", ".join(CREATE_PRIORITIES[:-1]) + " or " + CREATE_PRIORITIES[-1]
        raise FormatError(f"Case {number} ({title}): priority '{value}' is not valid; use {allowed}")
    value = "" if case.get("draft") is None else str(case["draft"]).strip()
    if value.casefold() not in CREATE_DRAFT_TRUE | CREATE_DRAFT_FALSE | {""}:
        raise FormatError(f"Case {number} ({title}): draft '{value}' is not valid; use yes or no")
    return priority, not value or value.casefold() in CREATE_DRAFT_TRUE


def _suite_paths(pivot):
    by_id = {s["id"]: s for s in pivot["suites"]}

    def path(suite_id):
        parts = []
        while suite_id is not None:
            suite = by_id[suite_id]
            parts.append(suite["title"])
            suite_id = suite["parent"]
        return PATH_SEP.join(reversed(parts))

    return {sid: path(sid) for sid in by_id}


def pivot_to_rows(pivot):
    paths = _suite_paths(pivot)
    for case in pivot["cases"]:
        steps = case["steps"] or [["", ""]]
        for n, (action, expected) in enumerate(steps, 1):
            first = n == 1
            yield {
                "key": case["key"],
                "suite_path": paths[case["suite"]] if first else "",
                "title": case["title"] if first else "",
                "priority": case["priority"] if first else "",
                "draft": ("yes" if case.get("draft") else "no") if first else "",
                "description": case.get("desc", "") if first else "",
                "preconditions": case.get("pre", "") if first else "",
                "postconditions": case.get("post", "") if first else "",
                "step_no": n,
                "action": action,
                "expected": expected,
            }


def _truthy(value):
    return str(value).strip().lower() in ("yes", "true", "1", "y")


def _steps(raw):
    """[[a, e], ...] or [{"action", "expected"}, ...] -> [[a, e], ...]; empty steps dropped."""
    steps = []
    for step in raw or []:
        if isinstance(step, dict):
            action, expected = step.get("action", ""), step.get("expected", step.get("expectedResult", ""))
        else:
            action, expected = (list(step) + ["", ""])[:2]
        if action or expected:
            steps.append([str(action or ""), str(expected or "")])
    return steps


def cases_to_pivot(cases, product, *, require_key=True, strict_values=False):
    """Plain case dicts (with suite_path and steps) -> pivot. Raises FormatError with the case number."""
    suites, suite_ids, result, seen = [], {}, [], set()
    seen_titles = set()

    def suite_id(path_text):
        parts = [p.strip() for p in str(path_text).split(PATH_SEP.strip()) if p.strip()]
        if not parts:
            raise FormatError("suite_path is empty")
        parent = None
        for depth in range(len(parts)):
            key = tuple(parts[: depth + 1])
            if key not in suite_ids:
                suite_ids[key] = len(suite_ids) + 1
                suites.append({"id": suite_ids[key], "parent": parent, "title": parts[depth]})
            parent = suite_ids[key]
        return parent

    for number, case in enumerate(cases, 1):
        key = str(case.get("key") or "").strip()
        if require_key and not key:
            raise FormatError(f"Case {number}: 'key' is required (used to avoid duplicates)")
        if key and key in seen:
            raise FormatError(f"Case {number}: duplicate key {key}")
        if key:
            seen.add(key)
        if not case.get("title") or not case.get("suite_path"):
            if not key:
                raise FormatError(f"Case {number}: title and suite_path are required")
            raise FormatError(f"Case {number} ({key}): title and suite_path are required")
        if not key:
            title, suite_path = str(case["title"]), str(case["suite_path"])
            identity = (
                tuple(p.strip().casefold() for p in suite_path.split(">") if p.strip()),
                title.strip().casefold(),
            )
            if identity in seen_titles:
                raise FormatError(f"Case {number}: duplicate case '{title}' in {suite_path}")
            seen_titles.add(identity)
        if strict_values:
            priority, draft = _create_values(case, number)
        result.append(
            {
                "key": key or None,
                "suite": suite_id(case["suite_path"]),
                "priority": priority if strict_values else case.get("priority") or "Not set",
                "title": str(case["title"]),
                "desc": case.get("description", case.get("desc", "")) or "",
                "pre": case.get("preconditions", case.get("pre", "")) or "",
                "post": case.get("postconditions", case.get("post", "")) or "",
                "draft": draft if strict_values else _truthy(case.get("draft", False)),
                "steps": _steps(case.get("steps")),
            }
        )
    return {"product": product, "suites": suites, "cases": result}


def rows_to_pivot(rows, product):
    """Flat rows (one per step) -> pivot."""
    cases = {}
    for line, row in enumerate(rows, 2):
        row = {k: ("" if v is None else str(v)) for k, v in row.items()}
        key = row.get("key", "").strip()
        if not key:
            raise FormatError(f"Row {line}: 'key' is required (used to avoid duplicates)")
        if key not in cases:
            if not row.get("title") or not row.get("suite_path"):
                raise FormatError(f"Row {line}: first row of {key} needs title and suite_path")
            cases[key] = {**row, "key": key, "steps": []}
        cases[key]["steps"].append([row.get("action", ""), row.get("expected", "")])
    return cases_to_pivot(list(cases.values()), product)


def read_pivot(path, product=""):
    path = pathlib.Path(path).expanduser()
    suffix = path.suffix.lower()
    if suffix == ".json":
        pivot = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(pivot, list):  # plain list of cases, like import_cases
            if not product:
                raise FormatError("A JSON list of cases needs the product argument")
            return cases_to_pivot(pivot, product)
        if not isinstance(pivot, dict) or "cases" not in pivot or "suites" not in pivot:
            raise FormatError("JSON must be a list of cases or an object with 'suites' and 'cases'")
        if product:
            pivot["product"] = product
        if not pivot.get("product"):
            raise FormatError("JSON has no 'product'; pass the product argument")
        return pivot
    if not product:
        raise FormatError("CSV/XLSX files need the product argument")
    if suffix == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as fh:
            return rows_to_pivot(csv.DictReader(fh), product)
    if suffix in (".xlsx", ".xlsm"):
        from openpyxl import load_workbook

        sheet = load_workbook(path, read_only=True, data_only=True).worksheets[0]
        rows = sheet.iter_rows(values_only=True)
        header = [str(h).strip() if h is not None else "" for h in next(rows)]
        return rows_to_pivot((dict(zip(header, r)) for r in rows if any(r)), product)
    raise FormatError(f"Unsupported file type: {suffix} (use .json, .csv or .xlsx)")


def write_pivot(pivot, path):
    path = pathlib.Path(path).expanduser()
    suffix = path.suffix.lower()
    path.parent.mkdir(parents=True, exist_ok=True)
    if suffix == ".json":
        path.write_text(json.dumps(pivot, ensure_ascii=False, indent=1), encoding="utf-8")
    elif suffix == ".csv":
        buf = io.StringIO(newline="")
        writer = csv.DictWriter(buf, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(pivot_to_rows(pivot))
        path.write_text(buf.getvalue(), encoding="utf-8-sig")  # BOM: Excel opens UTF-8
    elif suffix == ".xlsx":
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "test cases"
        ws.append(COLUMNS)
        for row in pivot_to_rows(pivot):
            ws.append([row[c] for c in COLUMNS])
        wb.save(path)
    else:
        raise FormatError(f"Unsupported file type: {suffix} (use .json, .csv or .xlsx)")
    return path


FORMAT_HELP = """Test case import format (one case = one key in Kiwi, re-importing a key is skipped).

Fields per case:
  key            required, unique, e.g. KPWEB2-12 (also the duplicate check)
  suite_path     required, suite levels joined by ' > ', e.g. Owner > Login > Google
  title          required
  priority       High | Medium | Low | Trivial | Not set   (default Not set)
  draft          yes/no (draft becomes status PROPOSED)
  description, preconditions, postconditions   optional text
  steps          list of {"action": "...", "expected": "..."}

CSV / XLSX: columns key, suite_path, title, priority, draft, description, preconditions,
postconditions, step_no, action, expected. One row per step; the first row of a case carries
the case fields, following rows only key, step_no, action, expected.

JSON: a list of case objects with the fields above, e.g.
  [{"key": "K-1", "suite_path": "Owner > Login", "title": "Login ok", "priority": "High",
    "steps": [{"action": "Open app", "expected": ""}, {"action": "Tap login", "expected": "Home"}]}]

Send at most 100 cases per call to import_cases / import_csv_text. A bigger file goes in several
batches (re-sending a case is safe: existing keys are skipped). After the last batch, check that
created + skipped equals the number of cases in the user's file."""


CREATE_FORMAT_HELP = f"""Fixed table format for creating NEW test cases in Kiwi TCMS.

Column | Required/optional | Values
suite_path | required on the first row of a case | levels joined by ' > ', e.g. Owner > Login
title | required on the first row of a case | a non-blank title starts a new case
priority | optional | {', '.join(CREATE_PRIORITIES)}; blank = Not set
draft | optional | {', '.join(sorted(CREATE_DRAFT_TRUE | CREATE_DRAFT_FALSE))}; blank = yes (PROPOSED), no = CONFIRMED
description | optional | text
preconditions | optional | text
postconditions | optional | text
action | optional | step action
expected | optional | step expected result
key | optional backup-style extra, not in the template | stable case key; blank or the same key on step rows
step_no | optional backup-style extra, not in the template | ignored; steps stay in row order

One row per step. A row with a title starts a case and must include suite_path.
Further steps have an empty title and may only fill action, expected, step_no and the same key.
Blank rows are skipped. Cases without actions or expected results have no steps.
Header names are normalized: strip a leading BOM and surrounding whitespace, casefold,
and replace runs of spaces, underscores or hyphens with a single underscore.
Empty columns with blank headers or pandas 'Unnamed: n' headers are ignored anywhere in the table; headerless columns containing values (e.g. a row-index column) are rejected.
Only these columns are accepted: {', '.join(CREATE_COLUMNS + CREATE_EXTRA_COLUMNS)}.
suite_path and title must be in the header. Unknown, missing required or duplicate normalized columns are errors.
Priority and draft values are case-insensitive and strict; other values are rejected.
Surrounding cell whitespace is stripped; inner whitespace and line breaks are preserved.
CSV delimiters: comma, semicolon or TAB (detected from the header; ties use comma).
Quote cells that contain delimiters or line breaks.

Example CSV (two cases, three steps then one step; the blank row is optional):
{','.join(CREATE_COLUMNS)}
Owner > Login,Login succeeds,High,yes,Valid account,Account exists,,Open login,Form appears
,,,,,,,Enter credentials,Credentials accepted
,,,,,,,Click Login,Home appears

Owner > Login,Wrong password,Medium,yes,,,,Enter wrong password,Error appears

How to get the data:
- CSV file: send its text as `csv_text` unchanged.
- Excel (.xlsx) file: read the FIRST sheet (the one with the header row `suite_path, title, ...`) with your own file tools and send it as CSV text; copy cell values as they are, keep the header names and the multi-row layout, do not summarise, merge, translate or reorder anything. `.xls` and Numbers files must be saved by the user as .xlsx or CSV first.
- Google Sheets link: the server does NOT open links. Read the sheet with your own Google Drive / Sheets access when you have it, or ask the user to download the tab as CSV (File > Download > Comma-separated values) or .xlsx and attach it; if the sheet is shared as "anyone with the link" you may fetch its CSV export yourself (`https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<tab id>`). Use the tab that holds the cases (the `gid` in the link), then proceed as for CSV.
- Always run with dry_run=true first and show the preview; more than 100 cases -> send several calls (existing titles are skipped).

The server receives only table text, never files or links to fetch. The product must already exist.
Up to 100 cases and 1,000,000 characters per call; key-less duplicates use suite/plan + title.
"""
