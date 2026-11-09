"""URLconf: upstream routes, with the dashboard replaced by AllDataDashboardView."""
from django.urls import re_path

from kiwi_custom_package.dashboard import AllDataDashboardView
from kiwi_custom_package.register import AutoActivateRegister
from tcms.urls import *  # noqa: F401,F403
from tcms.urls import urlpatterns as _upstream

urlpatterns = [
    re_path(r"^$", AllDataDashboardView.as_view(), name="core-views-index"),
    re_path(
        r"^accounts/register/$",
        AutoActivateRegister.as_view(),
        name="tcms-register",
    ),
] + _upstream
