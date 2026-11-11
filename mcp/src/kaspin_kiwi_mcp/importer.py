"""Pivot dict -> Kiwi TCMS through JSON-RPC. Mapping ported from scripts/import_zebrunner_suite.py.

project -> Product, suite -> TestPlan (nested via parent), suite title -> Category,
case key -> Tag (also the duplicate check), draft -> status PROPOSED.
Safe to re-run: existing plans, categories and cases (found by key tag) are left alone.
"""
PRIORITY = {"High": "P1", "Medium": "P3", "Low": "P4", "Trivial": "P5", "Not set": "P3"}
CLASSIFICATION = "Zebrunner Import"
VERSION = "unspecified"
PLAN_TYPE = "Function"


def numbered(items):
    """Markdown ordered list; a single item stays plain text.

    Numbers follow the step position, so skipped empty items leave gaps.
    """
    items = [(i, t) for i, t in items if t]
    if len(items) == 1 and items[0][0] == 1:
        return items[0][1]
    return "\n".join(f"{i}. " + t.replace("\n", "\n   ") for i, t in items)


def case_text(case):
    steps = case["steps"]
    sections = []
    if case.get("desc"):
        sections.append(f"**Description**\n\n{case['desc']}")
    if case.get("pre"):
        sections.append(f"**Setup**\n\n{case['pre']}")
    if any(a for a, _ in steps):
        sections.append("**Actions**\n\n" + numbered((i, a) for i, (a, _) in enumerate(steps, 1)))
    if any(e for _, e in steps):
        sections.append(
            "**Expected results**\n\n" + numbered((i, e) for i, (_, e) in enumerate(steps, 1))
        )
    if case.get("post"):
        sections.append(f"**Teardown**\n\n{case['post']}")
    return "\n\n".join(sections) + "\n" if sections else "(no steps)\n"


def new_report(pivot, dry_run):
    return {"product": pivot["product"], "dry_run": dry_run, "plans_new": 0, "cases_new": [],
            "cases_existing": [], "total": len(pivot["cases"]), "processed": 0}  # fmt: skip


def import_pivot(kiwi, pivot, dry_run=True, report=None):
    """Create everything missing in Kiwi. With dry_run only reads, never writes.

    ``report`` may be passed in (and read by another thread) to follow progress.
    """
    report = report if report is not None else new_report(pivot, dry_run)

    def lookup(method, query, what):
        item = kiwi.first(method, query)
        if not item:
            raise RuntimeError(f"{what} {query} does not exist in Kiwi")
        return item["id"]

    plan_type = lookup("PlanType.filter", {"name": PLAN_TYPE}, "Plan type")
    status = {n: lookup("TestCaseStatus.filter", {"name": n}, "Status") for n in ("CONFIRMED", "PROPOSED")}
    priority = {p: lookup("Priority.filter", {"value": v}, "Priority") for p, v in PRIORITY.items()}

    product = kiwi.first("Product.filter", {"name": pivot["product"]})
    if not product and not dry_run:
        classification = kiwi.first("Classification.filter", {"name": CLASSIFICATION}) or kiwi.call(
            "Classification.create", {"name": CLASSIFICATION}
        )
        product = kiwi.call("Product.create", {"name": pivot["product"], "classification": classification["id"]})
    # Kiwi itself adds an "unspecified" version to every new product, so look before creating.
    version = kiwi.first("Version.filter", {"product": product["id"], "value": VERSION}) if product else None
    if product and not version and not dry_run:
        version = kiwi.call("Version.create", {"product": product["id"], "value": VERSION})
    product_id = product["id"] if product else None

    plans, categories = {}, {}
    for suite in pivot["suites"]:  # parents come before children
        parent_id = plans.get(suite["parent"])
        # parent plan not created yet (dry run) -> this plan cannot exist either
        parent_missing = suite["parent"] is not None and parent_id is None
        plan = None
        if product_id and not parent_missing:
            # same title under different parents must stay separate plans
            plan = kiwi.first("TestPlan.filter", {"name": suite["title"], "product": product_id, "parent": parent_id})
        if not plan:
            report["plans_new"] += 1
            if not dry_run:
                values = {
                    "name": suite["title"], "product": product_id, "product_version": version["id"],
                    "type": plan_type, "text": f"Imported from Zebrunner suite {suite['id']}",
                }  # fmt: skip
                if suite["parent"] is not None:
                    values["parent"] = plans[suite["parent"]]
                plan = kiwi.call("TestPlan.create", values)
        plans[suite["id"]] = plan["id"] if plan else None
    titles = {s["id"]: s["title"] for s in pivot["suites"]}

    for case in pivot["cases"]:
        report["processed"] += 1
        existing = (
            kiwi.first("TestCase.filter", {"tag__name": case["key"], "category__product": product_id})
            if product_id
            else None
        )
        if existing:
            report["cases_existing"].append(case["key"])
            continue
        report["cases_new"].append(case["key"])
        if dry_run:
            continue
        name = titles[case["suite"]]
        if name not in categories:
            category = kiwi.first("Category.filter", {"product": product_id, "name": name}) or kiwi.call(
                "Category.create", {"product": product_id, "name": name}
            )
            categories[name] = category["id"]
        created = kiwi.call(
            "TestCase.create",
            {
                "summary": case["title"], "product": product_id, "category": categories[name],
                "priority": priority.get(case["priority"], priority["Not set"]),
                "case_status": status["PROPOSED" if case.get("draft") else "CONFIRMED"],
                "text": case_text(case), "is_automated": False,
            },
        )  # fmt: skip
        kiwi.call("TestCase.add_tag", created["id"], case["key"])
        kiwi.call("TestPlan.add_case", plans[case["suite"]], created["id"])
    return report


def format_report(report):
    mode = "DRY RUN (nothing written)" if report["dry_run"] else "IMPORTED"
    if report["processed"] < report["total"]:
        mode += f" - in progress {report['processed']}/{report['total']}"
    new, old = report["cases_new"], report["cases_existing"]
    lines = [
        f"{mode} - product {report['product']}",
        f"test plans to create: {report['plans_new']}",
        f"cases {'to create' if report['dry_run'] else 'created'}: {len(new)}",
        f"cases already in Kiwi (skipped): {len(old)}",
    ]
    if new:
        lines.append("new: " + ", ".join(new[:15]) + (" ..." if len(new) > 15 else ""))
    if report["dry_run"] and new:
        lines.append("Run again with dry_run=false to write these to Kiwi.")
    return "\n".join(lines)
