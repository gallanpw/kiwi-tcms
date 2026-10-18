"""Import a Zebrunner suite tree (JSON export) into Kiwi TCMS.

Run: ./run.sh shell -c "exec(open('scripts/import_zebrunner_suite.py').read())"

Mapping: project -> Product, suite -> TestPlan (nested via parent),
suite title -> Category, Zebrunner key -> Tag. Safe to re-run.
"""
import json
import pathlib

from django.contrib.auth import get_user_model

from tcms.management.models import Classification, Priority, Product, Tag, Version
from tcms.testcases.models import Category, TestCase, TestCaseStatus
from tcms.testplans.models import PlanType, TestPlan

DATA = json.loads(pathlib.Path("scripts/zebrunner_kpapi_suite.json").read_text())
PRIORITY = {"High": "P1", "Medium": "P3", "Low": "P4", "Trivial": "P5"}

author = get_user_model().objects.get(username="admin")
classification, _ = Classification.objects.get_or_create(name="Zebrunner Import")
product, _ = Product.objects.get_or_create(
    name=DATA["product"], defaults={"classification": classification}
)
version, _ = Version.objects.get_or_create(product=product, value="unspecified")
plan_type = PlanType.objects.get(name="Function")
status = TestCaseStatus.objects.get(name="CONFIRMED")

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
    actions = "\n".join(f"{i}. {a}" for i, (a, _) in enumerate(case["steps"], 1))
    expected = "\n".join(f"{i}. {e}" for i, (_, e) in enumerate(case["steps"], 1))
    text = (
        f"**Setup**\n\n{case['pre']}\n\n**Actions**\n\n{actions}\n\n"
        f"**Expected results**\n\n{expected}\n\n**Teardown**\n"
    )
    obj, created = TestCase.objects.get_or_create(
        summary=case["title"],
        category=category,
        defaults={
            "text": text,
            "author": author,
            "case_status": status,
            "priority": Priority.objects.get(value=PRIORITY[case["priority"]]),
            "is_automated": False,
        },
    )
    obj.add_tag(Tag.objects.get_or_create(name=case["key"])[0])
    plans[case["suite"]].add_case(obj)
    print("created" if created else "exists ", case["key"], obj.pk, obj.summary)
