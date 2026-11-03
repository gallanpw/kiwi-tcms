from django.urls import re_path

from tcms.management import api, views

urlpatterns = [
    re_path(r"^projects/?$", views.projects_page, name="projects-list"),
    re_path(
        r"^project/(?P<project_code>[^/]+)/testcases/?$",
        views.project_testcases_page,
        name="project-testcases",
    ),
    re_path(r"^api/projects/?$", api.projects, name="api-projects"),
    re_path(r"^api/projects/(?P<project_id>\d+)/?$", api.project_detail, name="api-project-detail"),
    re_path(
        r"^api/projects/(?P<project_code>[^/]+)/testcases/?$",
        api.project_testcases,
        name="api-project-testcases",
    ),
    re_path(
        r"^api/projects/(?P<project_code>[^/]+)/testcases/(?P<case_id>\d+)/?$",
        api.delete_testcase,
        name="api-project-testcase-delete",
    ),
    re_path(r"^api/suites/?$", api.suites, name="api-suites"),
    re_path(r"^api/suites/(?P<suite_id>\d+)/?$", api.suite_detail, name="api-suite-detail"),
]
