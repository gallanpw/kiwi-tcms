"""Import Zebrunner test runs (JSON export) into Kiwi TCMS.

Run: ./run.sh shell -c "exec(open('scripts/import_zebrunner_runs.py').read())"
Set ZEBRUNNER_RUNS to use another file (default scripts/zebrunner_runs.json).

Mapping: run -> TestRun on the plan that holds its cases, configuration
(group, option) -> run Property, result status -> TestExecutionStatus.
Zebrunner users are not Kiwi users, so manager, assignee and tested_by
are "admin". Cases are found by their Zebrunner key tag (see
import_zebrunner_suite.py). Safe to re-run: existing runs and executions
are left as they are.
"""
import json
import os
import pathlib

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from tcms.management.models import Build
from tcms.testcases.models import TestCase
from tcms.testruns.models import (
    Property,
    TestExecution,
    TestExecutionStatus,
    TestRun,
)

DATA = json.loads(
    pathlib.Path(
        os.environ.get("ZEBRUNNER_RUNS", "scripts/zebrunner_runs.json")
    ).read_text()
)
# Kiwi has no equivalent of these two, so they are added as statuses.
CUSTOM_STATUSES = {
    "RETEST": {"weight": 0, "icon": "fa fa-refresh", "color": "#82b8fd"},
    "PASSED WITH NOTE": {
        "weight": 15,
        "icon": "fa fa-check-circle",
        "color": "#24c2b3",
    },
}
STATUS = {
    "Untested": "IDLE",
    "Passed": "PASSED",
    "Failed": "FAILED",
    "Blocked": "BLOCKED",
    "Skipped": "WAIVED",
    "Retest": "RETEST",
    "Passed W/Note": "PASSED WITH NOTE",
    "Pass With Note": "PASSED WITH NOTE",
    "Passed with notes": "PASSED WITH NOTE",
}

for name, defaults in CUSTOM_STATUSES.items():
    TestExecutionStatus.objects.get_or_create(name=name, defaults=defaults)
statuses = {s.name: s for s in TestExecutionStatus.objects.all()}

admin = get_user_model().objects.get(username="admin")

for item in DATA["runs"]:
    cases = [
        TestCase.objects.get(
            category__product__name=item["product"], tag__name=key
        )
        for key, _, _ in item["items"]
    ]
    plans = {plan for case in cases for plan in case.plan.all()}
    assert len(plans) == 1, f"{item['title']}: cases are in {len(plans)} plans"
    plan = plans.pop()
    build = Build.objects.get(version__product=plan.product, name="unspecified")

    started = parse_datetime(item["created"])
    if not settings.USE_TZ:  # SQLite rejects aware datetimes in that case
        started = timezone.make_naive(started)
    source = f"{DATA['base_url']}/projects/{item['product']}/test-runs/{item['id']}"
    run, created = TestRun.objects.get_or_create(
        summary=item["title"],
        plan=plan,
        defaults={
            "build": build,
            "manager": admin,
            "default_tester": admin,
            "notes": f"{item['description']}\n\nImported from Zebrunner: {source}",
            "start_date": started,
        },
    )
    print("created" if created else "exists ", "run", run.pk, run.summary)

    for group, option in item["configurations"]:
        Property.objects.get_or_create(run=run, name=group, value=option)

    for case, (key, status, assigned) in zip(cases, item["items"]):
        _, created = TestExecution.objects.get_or_create(
            run=run,
            case=case,
            defaults={
                "assignee": admin if assigned else None,
                "tested_by": admin if status != "Untested" else None,
                "status": statuses[STATUS[status]],
                "case_text_version": case.history.latest().history_id,
                "build": build,
                "sortkey": 0,
            },
        )
        print("  created" if created else "  exists ", key, STATUS[status])
