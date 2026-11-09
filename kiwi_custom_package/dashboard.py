"""Dashboard that shows all data to superusers.

Upstream's DashboardView only lists plans authored by, and runs assigned to,
the logged-in user. A superuser who manages several teams then sees an empty
dashboard. Superusers get every active plan and every unfinished run instead;
everyone else keeps the upstream dashboard unchanged.
"""
from django.db.models import Count

from tcms.core.views import DashboardView
from tcms.testplans.models import TestPlan
from tcms.testruns.models import TestRun


class AllDataDashboardView(DashboardView):
    def get_template_names(self):
        if self.request.user.is_superuser:
            return ["dashboard_all.html"]
        return super().get_template_names()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if not self.request.user.is_superuser:
            return context

        plans = (
            TestPlan.objects.order_by("-pk")
            .select_related("product", "type")
            .annotate(num_runs=Count("run", distinct=True))
        )
        runs = TestRun.objects.filter(stop_date__isnull=True).order_by("-pk")
        context.update(
            {
                "test_plans_count": plans.count(),
                "test_plans_disable_count": plans.filter(is_active=False).count(),
                "last_15_test_plans": plans.filter(is_active=True)[:15],
                "last_15_test_runs": runs[:15],
                "test_runs_count": runs.count(),
            }
        )
        return context
