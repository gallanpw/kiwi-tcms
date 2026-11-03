# -*- coding: utf-8 -*-

from django.urls import re_path

from .. import views

urlpatterns = [
    re_path(
        r"^(?P<project_code>[^/]+)/(?P<case_code>[^/]+)/edit/$",
        views.ProjectEditTestCaseView.as_view(),
        name="testcases-edit-project",
    ),
    re_path(
        r"^(?P<project_code>[^/]+)/(?P<case_code>[^/]+)/$",
        views.ProjectTestCaseGetView.as_view(),
        name="testcases-get-project",
    ),
    re_path(r"^(?P<pk>\d+)/$", views.TestCaseGetView.as_view(), name="testcases-get"),
    re_path(
        r"^(?P<pk>\d+)/edit/$", views.EditTestCaseView.as_view(), name="testcases-edit"
    ),
]
