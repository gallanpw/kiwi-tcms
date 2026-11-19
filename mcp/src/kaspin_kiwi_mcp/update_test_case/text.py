"""Conservative parsing and merging of the importer's case text; no I/O."""
import re

from ..backup_test_case.formats import _steps
from ..backup_test_case.importer import case_text

SECTIONS = ("Description", "Setup", "Actions", "Expected results", "Teardown")
_HEADER = re.compile(r"(?:\A|\n\n)\*\*(Description|Setup|Actions|Expected results|Teardown)\*\*\n\n")
_ITEM = re.compile(r"([1-9][0-9]*)\. (.*)")


def _parse_numbered(body):
    """Recover positions and undo numbered() indentation, retaining plain single items."""
    lines = body.split("\n")
    if not _ITEM.fullmatch(lines[0]):
        return {1: body}
    items = {}
    position = 0
    for line in lines:
        match = _ITEM.fullmatch(line)
        if match:
            number = match[1]
            # A position larger than the body cannot be recovered without invisible
            # empty steps. Refuse it before allocating or converting huge integers.
            if len(number) > len(str(len(body))):
                return None
            number = int(number)
            if number <= position:
                return None
            position = number
            items[position] = match[2]
        elif line.startswith("   "):
            items[position] += "\n" + line[3:]
        else:
            return None
    # A single position-1 item is emitted without numbering. Guessing here
    # would turn the literal action "1. foo" into "foo".
    if list(items) == [1]:
        return None
    return items


def parse_case_text(text) -> dict | None:
    """Parse case_text before or after Kiwi strips trailing whitespace; require a round trip."""
    parsed = {"desc": "", "pre": "", "post": "", "steps": []}
    if not text.strip() or text.strip() == "(no steps)":
        return parsed
    # Kiwi's ModelForms strip the final newline and any trailing section whitespace.
    text = text.rstrip() + "\n"
    headers = list(_HEADER.finditer(text))
    if not headers or headers[0].start() != 0:
        return None
    names = [header[1] for header in headers]
    if names != sorted(set(names), key=SECTIONS.index):
        return None
    bodies = {}
    for index, header in enumerate(headers):
        end = headers[index + 1].start() if index + 1 < len(headers) else len(text) - 1
        body = text[header.end():end]
        if not body:
            return None
        bodies[header[1]] = body
    for name, key in (("Description", "desc"), ("Setup", "pre"), ("Teardown", "post")):
        parsed[key] = bodies.get(name, "")
    actions = _parse_numbered(bodies["Actions"]) if "Actions" in bodies else {}
    expected = _parse_numbered(bodies["Expected results"]) if "Expected results" in bodies else {}
    if actions is None or expected is None:
        return None
    positions = actions.keys() | expected.keys()
    if positions and len(positions) != max(positions):
        return None  # Fully empty, invisible steps cannot be recovered safely.
    parsed["steps"] = [(actions.get(i, ""), expected.get(i, "")) for i in range(1, len(positions) + 1)]
    return parsed if case_text(parsed).rstrip() == text.rstrip() else None


def merge_case_parts(parsed, *, description=None, preconditions=None, postconditions=None, steps=None):
    """Replace supplied sections, using the same step normalization as creation."""
    merged = {**parsed, "steps": list(parsed["steps"])}
    for key, value in (("desc", description), ("pre", preconditions), ("post", postconditions)):
        if value is not None:
            merged[key] = value
    if steps is not None:
        merged["steps"] = [tuple(step) for step in _steps(steps)]
    return merged
