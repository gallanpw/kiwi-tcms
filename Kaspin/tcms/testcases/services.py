"""Project and suite services shared by views and API endpoints."""

from django.db import transaction

from tcms.testcases.models import Suite

PROJECT_ROOT_TITLE = "Project root"
CASE_CREATE_PROJECT_SESSION_KEY = "testcase_create_project_id"
CASE_CREATE_PROJECT_CODE_SESSION_KEY = "testcase_create_project_code"


def ensure_project_root(project):
    return Suite.objects.get_or_create(
        id_project=project,
        parent_suite=None,
        defaults={"title": PROJECT_ROOT_TITLE},
    )[0]


@transaction.atomic
def create_project_root(project):
    return ensure_project_root(project)
