"""Project-aware helpers for the Kaspin test-run views."""

from django.apps import apps
from django.shortcuts import get_object_or_404


class ProjectAwareTestRunMixin:
    """Accept project-scoped run URLs when the optional Project model exists."""

    def get_project(self, project_code=None):
        project_code = project_code or self.kwargs.get("project_code")
        if not project_code:
            return None

        try:
            project_model = apps.get_model("management", "Project")
        except LookupError:
            # The upstream Kiwi schema has no Project model. Keep the run form
            # usable there while allowing the project extension to provide it.
            return None

        project = get_object_or_404(project_model, code=project_code)
        self.request.session["testcase_create_project_id"] = project.pk
        self.request.session["testcase_create_project_code"] = project.code
        return project
