from django.test import TestCase

from tcms.bugs.api import filter as filter_bugs
from tcms.bugs.tests.factory import BugFactory
from tcms.management.models import Project
from tcms.rpc.api.testexecution import filter as filter_executions
from tcms.rpc.api.testplan import filter as filter_plans
from tcms.rpc.api.testrun import filter as filter_runs
from tcms.telemetry.api import breakdown
from tcms.testcases.services import ensure_project_root
from tcms.tests.factories import (
    TestCaseFactory,
    TestExecutionFactory,
    TestPlanFactory,
    TestRunFactory,
)


class ProjectScopedDataTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.project_a = Project.objects.create(name="Project A", code="PROJECT-A")
        cls.project_b = Project.objects.create(name="Project B", code="PROJECT-B")
        cls.suite_a = ensure_project_root(cls.project_a)
        cls.suite_b = ensure_project_root(cls.project_b)

        cls.case_a = TestCaseFactory(id_suite=cls.suite_a)
        cls.case_b = TestCaseFactory(id_suite=cls.suite_b)
        cls.plan_a = TestPlanFactory(id_project=cls.project_a)
        cls.plan_b = TestPlanFactory(id_project=cls.project_b)
        cls.run_a = TestRunFactory(plan=cls.plan_a)
        cls.run_b = TestRunFactory(plan=cls.plan_b)
        cls.execution_a = TestExecutionFactory(run=cls.run_a, case=cls.case_a)
        cls.execution_b = TestExecutionFactory(run=cls.run_b, case=cls.case_b)
        cls.bug_a = BugFactory(id_project=cls.project_a)
        cls.bug_b = BugFactory(id_project=cls.project_b)

    def test_project_id_scopes_plan_run_and_bug_searches(self):
        project_id = self.project_a.pk

        self.assertEqual(
            [row["id"] for row in filter_plans({"project_id": project_id})],
            [self.plan_a.pk],
        )
        self.assertEqual(
            [row["id"] for row in filter_runs({"project_id": project_id})],
            [self.run_a.pk],
        )
        self.assertEqual(
            [row["pk"] for row in filter_bugs({"project_id": project_id})],
            [self.bug_a.pk],
        )

    def test_project_id_scopes_execution_search_and_case_breakdown(self):
        project_id = self.project_a.pk

        self.assertEqual(
            [row["id"] for row in filter_executions({"project_id": project_id})],
            [self.execution_a.pk],
        )
        self.assertEqual(
            breakdown({"project_id": project_id})["count"]["all"],
            1,
        )

    def test_searches_remain_global_without_project_id(self):
        self.assertEqual(len(filter_plans({})), 2)
        self.assertEqual(len(filter_runs({})), 2)
        self.assertEqual(len(filter_bugs({})), 2)
        self.assertEqual(len(filter_executions({})), 2)

    def test_invalid_project_id_is_reported(self):
        with self.assertRaisesRegex(ValueError, "project_id must be an integer"):
            filter_plans({"project_id": "invalid"})
