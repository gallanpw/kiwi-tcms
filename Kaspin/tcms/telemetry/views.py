from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from django.shortcuts import get_object_or_404

from tcms.management.models import Project


@method_decorator(login_required, name="dispatch")
class ProjectAwareTelemetryView(TemplateView):
    """Provide optional project context for project-scoped telemetry pages."""

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        project_code = self.kwargs.get("project_code")
        if project_code:
            context["project"] = get_object_or_404(Project, code=project_code)
        return context


@method_decorator(login_required, name="dispatch")
class TestingBreakdownView(
    ProjectAwareTelemetryView
):  # pylint: disable=missing-permission-required
    template_name = "telemetry/testing/breakdown.html"


@method_decorator(login_required, name="dispatch")
class TestingExecutionDashboard(
    ProjectAwareTelemetryView
):  # pylint: disable=missing-permission-required
    template_name = "telemetry/testing/execution-dashboard.html"


@method_decorator(login_required, name="dispatch")
class TestingStatusMatrixView(
    TemplateView
):  # pylint: disable=missing-permission-required
    template_name = "telemetry/testing/status-matrix.html"


@method_decorator(login_required, name="dispatch")
class TestingExecutionTrendsView(
    TemplateView
):  # pylint: disable=missing-permission-required
    template_name = "telemetry/testing/execution-trends.html"


@method_decorator(login_required, name="dispatch")
class TestingTestCaseHealth(
    ProjectAwareTelemetryView
):  # pylint: disable=missing-permission-required
    template_name = "telemetry/testing/test-case-health.html"
