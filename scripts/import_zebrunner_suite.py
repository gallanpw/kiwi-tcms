"""Import a Zebrunner suite tree (JSON export) into Kiwi TCMS.

Run: ZEBRUNNER_JSON=scripts/zebrunner_kpfree_suite.json \
     ./run.sh shell -c "exec(open('scripts/import_zebrunner_suite.py').read())"
Without ZEBRUNNER_JSON the KPAPI export is imported.

Mapping: project -> Product, suite -> TestPlan (nested via parent),
suite title -> Category, Zebrunner key -> Tag, draft -> status PROPOSED.
Safe to re-run.
"""
import json
import os
import pathlib

from django.contrib.auth import get_user_model

from tcms.management.models import Classification, Priority, Product, Tag, Version
from tcms.testcases.models import Category, TestCase, TestCaseStatus
from tcms.testplans.models import PlanType, TestPlan

DATA = json.loads(
    pathlib.Path(
        os.environ.get("ZEBRUNNER_JSON", "scripts/zebrunner_kpapi_suite.json")
    ).read_text()
)
PRIORITY = {"High": "P1", "Medium": "P3", "Low": "P4", "Trivial": "P5", "Not set": "P3"}


def numbered(items):
    """Markdown ordered list; a single item stays plain text.

    Numbers follow the step position, so skipped empty items leave gaps.
    """
    items = [(i, t) for i, t in items if t]
    if len(items) == 1 and items[0][0] == 1:
        return items[0][1]
    return "\n".join(f"{i}. " + t.replace("\n", "\n   ") for i, t in items)


author = get_user_model().objects.get(username="admin")
classification, _ = Classification.objects.get_or_create(name="Zebrunner Import")
product, _ = Product.objects.get_or_create(
    name=DATA["product"], defaults={"classification": classification}
)
version, _ = Version.objects.get_or_create(product=product, value="unspecified")
plan_type = PlanType.objects.get(name="Function")
confirmed = TestCaseStatus.objects.get(name="CONFIRMED")
proposed = TestCaseStatus.objects.get(name="PROPOSED")

plans = {}
for suite in DATA["suites"]:  # parents are listed before children
    plan, _ = TestPlan.objects.get_or_create(
        name=suite["title"],
        product=product,
        defaults={
            "author": author,
            "product_version": version,
            "type": plan_type,
            "parent": plans.get(suite["parent"]),
        },
    )
    plans[suite["id"]] = plan

suite_title = {s["id"]: s["title"] for s in DATA["suites"]}
for case in DATA["cases"]:
    category, _ = Category.objects.get_or_create(
        product=product, name=suite_title[case["suite"]]
    )
    steps = case["steps"]
    sections = []
    if case.get("desc"):
        sections.append(f"**Description**\n\n{case['desc']}")
    if case.get("pre"):
        sections.append(f"**Setup**\n\n{case['pre']}")
    sections.append(
        "**Actions**\n\n" + numbered((i, a) for i, (a, _) in enumerate(steps, 1))
    )
    if any(e for _, e in steps):
        sections.append(
            "**Expected results**\n\n"
            + numbered((i, e) for i, (_, e) in enumerate(steps, 1))
        )
    if case.get("post"):
        sections.append(f"**Teardown**\n\n{case['post']}")
    obj, created = TestCase.objects.get_or_create(
        summary=case["title"],
        category=category,
        defaults={
            "text": "\n\n".join(sections) + "\n",
            "author": author,
            "case_status": proposed if case.get("draft") else confirmed,
            "priority": Priority.objects.get(value=PRIORITY[case["priority"]]),
            "is_automated": False,
        },
    )
    obj.add_tag(Tag.objects.get_or_create(name=case["key"])[0])
    plans[case["suite"]].add_case(obj)
    print("created" if created else "exists ", case["key"], obj.pk, obj.summary)
