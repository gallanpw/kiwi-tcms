"""URLconf: upstream routes, with the dashboard replaced by AllDataDashboardView."""
from django.urls import re_path

from kiwi_dashboard import AllDataDashboardView
from tcms.urls import *  # noqa: F401,F403
from tcms.urls import urlpatterns as _upstream

urlpatterns = [
    re_path(r"^$", AllDataDashboardView.as_view(), name="core-views-index"),
] + _upstream
