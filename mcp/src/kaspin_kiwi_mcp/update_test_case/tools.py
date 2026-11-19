import json

from mcp.server.fastmcp import Context

from ..backup_test_case.formats import CREATE_PRIORITIES
from ..backup_test_case.importer import PRIORITY, case_text
from ..core import config
from ..core.runtime import _login, _thread
from .text import merge_case_parts, parse_case_text


async def _find_case(ctx, product, case_id):
    kiwi = await _login(config.creds_from_context(ctx))
    found = await _thread(kiwi.first, "Product.filter", {"name": product})
    if not found:
        raise ValueError(f"Product '{product}' does not exist in Kiwi.")
    case = await _thread(kiwi.first, "TestCase.filter", {"id": case_id, "category__product": found["id"]})
    if not case:
        raise ValueError(f"Test case #{case_id} was not found in product '{product}'.")
    return kiwi, case


def _truncate(value, limit):
    return value[:limit] + "\n... (truncated)" if len(value) > limit else value


def _field_lines(label, value, indent=""):
    value = value or "(none)"
    if "\n" not in value:
        return [f"{indent}{label}: {value}"]
    return [f"{indent}{label}:"] + [f"{indent}  {line}" for line in value.split("\n")]


def _step_lines(steps, indent="  "):
    lines = []
    for number, (action, expected) in enumerate(steps, 1):
        prefix = f"{indent}{number}. "
        action_lines = _field_lines("action", action, " " * len(prefix))
        action_lines[0] = prefix + action_lines[0][len(prefix):]
        lines.extend(action_lines)
        lines.extend(_field_lines("expected", expected, " " * len(prefix)))
    return lines or [indent + "(none)"]


async def get_test_case(ctx: Context, product: str, case_id: int) -> str:
    """Read ONE existing test case in Kiwi TCMS, including tags and text sections. Nothing is written. Call this before update_test_case; product must own the case."""
    kiwi, case = await _find_case(ctx, product, case_id)
    tags = await _thread(kiwi.call, "Tag.filter", {"case": case_id})
    lines = [f"#{case_id} in product {product}"]
    for label, value in (("title", case["summary"]), ("status", case["case_status__name"]),
                         ("priority", case["priority__value"]), ("category", case["category__name"]),
                         ("tags", ", ".join(sorted({tag["name"] for tag in tags})))):
        lines.extend(_field_lines(label, value))
    parsed = parse_case_text(case["text"])
    if parsed is None:
        lines.append(
            "text format: raw (not written by kaspin-kiwi; update_test_case must receive "
            "description, preconditions, postconditions AND steps together to replace it)"
        )
        lines.extend(_field_lines("raw text", _truncate(case["text"], 4000)))
    else:
        lines.append("text format: kaspin (description, preconditions, steps, postconditions can be updated one by one)")
        for label, key in (("description", "desc"), ("preconditions", "pre")):
            lines.append(label + ":")
            lines.extend("  " + line for line in (parsed[key] or "(none)").split("\n"))
        lines.append("steps:")
        lines.extend(_step_lines(parsed["steps"]))
        lines.append("postconditions:")
        lines.extend("  " + line for line in (parsed["post"] or "(none)").split("\n"))
    return "\n".join(lines)


async def update_test_case(ctx: Context, product: str, case_id: int, title: str | None = None,
                           priority: str | None = None, status: str | None = None,
                           description: str | None = None, preconditions: str | None = None,
                           postconditions: str | None = None, steps: list[dict] | None = None,
                           dry_run: bool = True) -> str:
    """Updates ONE EXISTING test case in Kiwi TCMS (not Zebrunner). Partial update: omitted fields stay unchanged. dry_run=true (default) is a preview: nothing is written; write with dry_run=false only after the user agrees. Call get_test_case first.

    product must be the product that owns the case (safety check). Cannot move category/plan, edit tags/automation/components/attachments, nor update many cases at once. Status DISABLED = soft delete.

    title: non-empty, at most 255 characters. priority: High|Medium|Low|Trivial|Not set or P1..P5. status: a name that exists in this Kiwi instance (case-insensitive). None leaves a field unchanged; an empty description/preconditions/postconditions clears that section. steps: list of {"action": "...", "expected": "..."} replacing ALL steps; [] clears them. For raw text, send description, preconditions, postconditions AND steps together to replace it.
    """
    parts = (description, preconditions, postconditions, steps)
    if all(value is None for value in (title, priority, status, *parts)):
        raise ValueError(
            "Nothing to update: give at least one of title, priority, status, "
            "description, preconditions, postconditions, steps."
        )
    if title is not None:
        title = title.strip()
        if not title or len(title) > 255:
            raise ValueError("title must be non-empty and at most 255 characters.")
    if priority is not None:
        accepted = (*CREATE_PRIORITIES, "P1", "P2", "P3", "P4", "P5")
        if priority not in accepted:
            raise ValueError("priority must be one of: " + ", ".join(accepted) + ".")
        priority = PRIORITY.get(priority, priority)
    for name, value in (("description", description), ("preconditions", preconditions),
                        ("postconditions", postconditions)):
        if value is not None and not isinstance(value, str):
            raise ValueError(f"{name} must be a string.")
    if steps is not None and (not isinstance(steps, list) or any(not isinstance(step, dict) for step in steps)):
        raise ValueError('steps must be a list of {"action": "...", "expected": "..."}.')

    kiwi, case = await _find_case(ctx, product, case_id)
    values, lines = {}, []
    if title is not None and title != case["summary"]:
        values["summary"] = title
        lines.append(f"title: {json.dumps(case['summary'], ensure_ascii=False)} -> {json.dumps(title, ensure_ascii=False)}")
    if priority is not None:
        found = await _thread(kiwi.first, "Priority.filter", {"value": priority})
        if not found:
            raise ValueError(f"Priority '{priority}' does not exist in Kiwi.")
        if found["id"] != case["priority"]:
            values["priority"] = found["id"]
            lines.append(f"priority: {case['priority__value']} -> {priority}")
    if status is not None:
        statuses = await _thread(kiwi.call, "TestCaseStatus.filter", {})
        status = status.strip().upper()
        found = next((row for row in statuses if row["name"].upper() == status), None)
        if not found:
            raise ValueError("status must be one of: " + ", ".join(sorted(row["name"].upper() for row in statuses)) + ".")
        if found["id"] != case["case_status"]:
            values["case_status"] = found["id"]
            lines.append(f"status: {case['case_status__name']} -> {status}")
    if any(value is not None for value in parts):
        parsed = parse_case_text(case["text"])
        if parsed is None and any(value is None for value in parts):
            raise ValueError(
                "Stored text is not in kaspin format. Call get_test_case first, then send all four parts "
                "(description, preconditions, postconditions, steps), or restrict updates to title/priority/status."
            )
        merged = merge_case_parts(parsed or {"desc": "", "pre": "", "post": "", "steps": []},
                                  description=description, preconditions=preconditions,
                                  postconditions=postconditions, steps=steps)
        new_text = case_text(merged)
        if merged != parsed and new_text.rstrip() != case["text"].rstrip():
            values["text"] = new_text
            if parsed is None:
                lines.append("text: replacing raw text")
                lines.extend(_field_lines("before (raw text)", _truncate(case["text"], 1500), "  "))
                lines.extend(_field_lines("after", new_text, "  "))
            else:
                for label, key in (("description", "desc"), ("preconditions", "pre"), ("postconditions", "post")):
                    if parsed[key] != merged[key]:
                        lines.append(label + ": changed")
                        lines.extend(_field_lines("before", parsed[key], "  "))
                        lines.extend(_field_lines("after", merged[key], "  "))
                if parsed["steps"] != merged["steps"]:
                    lines.append(f"steps: {len(parsed['steps'])} -> {len(merged['steps'])} step(s)")
                    lines.append("  before:")
                    lines.extend(_step_lines(parsed["steps"], "    "))
                    lines.append("  after:")
                    lines.extend(_step_lines(merged["steps"], "    "))
    if not values:
        return f"No changes: test case #{case_id} already has these values."
    if "summary" in values:
        plans = await _thread(kiwi.call, "TestPlan.filter", {"cases": case_id})
        for plan in plans:
            matches = await _thread(kiwi.call, "TestCase.filter", {"plan": plan["id"], "summary__iexact": title})
            for other_id in sorted({row["id"] for row in matches if row["id"] != case_id}):
                lines.append(f"WARNING: another case #{other_id} in plan '{plan['name']}' already has this title.")
    if not dry_run:
        await _thread(kiwi.call, "TestCase.update", case_id, values)
    mode = "DRY RUN (nothing written)" if dry_run else "UPDATED"
    lines.insert(0, f"{mode} - test case #{case_id} in {product}")
    if dry_run:
        lines.append("Run again with dry_run=false to write this to Kiwi.")
    return "\n".join(lines)


def register(mcp):
    mcp.tool()(get_test_case)
    mcp.tool()(update_test_case)
