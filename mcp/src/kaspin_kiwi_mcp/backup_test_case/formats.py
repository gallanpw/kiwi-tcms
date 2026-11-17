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

COLUMNS = [
    "key", "suite_path", "title", "priority", "draft",
    "description", "preconditions", "postconditions",
    "step_no", "action", "expected",
]  # fmt: skip
PATH_SEP = " > "


class FormatError(ValueError):
    pass


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


def cases_to_pivot(cases, product):
    """Plain case dicts (with suite_path and steps) -> pivot. Raises FormatError with the case number."""
    suites, suite_ids, result, seen = [], {}, [], set()

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
        if not key:
            raise FormatError(f"Case {number}: 'key' is required (used to avoid duplicates)")
        if key in seen:
            raise FormatError(f"Case {number}: duplicate key {key}")
        seen.add(key)
        if not case.get("title") or not case.get("suite_path"):
            raise FormatError(f"Case {number} ({key}): title and suite_path are required")
        result.append(
            {
                "key": key,
                "suite": suite_id(case["suite_path"]),
                "priority": case.get("priority") or "Not set",
                "title": str(case["title"]),
                "desc": case.get("description", case.get("desc", "")) or "",
                "pre": case.get("preconditions", case.get("pre", "")) or "",
                "post": case.get("postconditions", case.get("post", "")) or "",
                "draft": _truthy(case.get("draft", False)),
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
