# -*- coding: utf-8 -*-

from django.urls import re_path

from tcms.testplans import views

urlpatterns = [
    re_path(
        r"^(?P<project_code>[^/]+)/search/$",
        views.SearchTestPlanView.as_view(),
        name="plans-search-project",
    ),
    re_path(
        r"^(?P<project_code>[^/]+)/new/$",
        views.NewTestPlanView.as_view(),
        name="plans-new-project",
    ),
    re_path(
        r"^(?P<pk>\d+)/(?:[-\w\d]*)$",
        views.TestPlanGetView.as_view(),
        name="test_plan_url",
    ),
    re_path(r"^(?P<pk>\d+)/edit/$", views.Edit.as_view(), name="plan-edit"),
    re_path(r"^(?P<pk>\d+)/clone/$", views.Clone.as_view(), name="plans-clone"),
    re_path(r"^search/$", views.SearchTestPlanView.as_view(), name="plans-search"),
    re_path(r"^new/$", views.NewTestPlanView.as_view(), name="plans-new"),
]
