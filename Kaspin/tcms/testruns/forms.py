# -*- coding: utf-8 -*-
from django import forms
from django.utils.translation import gettext_lazy as _

from tcms.core.forms.fields import UserField
from tcms.management.models import Build, Product, Version
from tcms.rpc.api.forms import DateTimeField
from tcms.testcases.models import TestCase
from tcms.testruns.models import Environment, TestRun


class NewRunForm(forms.ModelForm):
    class Meta:
        model = TestRun
        exclude = ("tag", "cc")  # pylint: disable=modelform-uses-exclude

    manager = UserField()
    default_tester = UserField(required=False)
    start_date = DateTimeField(required=False)
    stop_date = DateTimeField(required=False)
    planned_start = DateTimeField(required=False)
    planned_stop = DateTimeField(required=False)

    def __init__(self, *args, **kwargs):
        request = kwargs.pop("request", None)
        super().__init__(*args, **kwargs)
        if (
            request
            and hasattr(request, "tenant")
            and request.tenant.schema_name != "public"
        ):
            tenant_users = request.tenant.authorized_users.all()
            self.fields["manager"].queryset = tenant_users
            self.fields["default_tester"].queryset = tenant_users

    case = forms.ModelMultipleChoiceField(
        queryset=TestCase.objects.none(),
        required=False,
    )

    product = forms.ModelChoiceField(
        queryset=Product.objects.all(),
        required=False,
    )

    matrix_type = forms.ChoiceField(
        choices=(
            ("full", _("Full")),
            ("pairwise", _("Pairwise")),
        ),
        required=False,
    )

    environment = forms.ModelMultipleChoiceField(
        queryset=Environment.objects.all(),
        required=False,
    )

    def populate(self, plan_id, project_id=None):
        if project_id:
            self.fields["plan"].queryset = self.fields["plan"].queryset.filter(
                id_project_id=project_id
            )
        if plan_id:
            # plan is ModelChoiceField which contains all the plans
            # as we need only the plan for current run we filter the queryset
            self.fields["plan"].queryset = self.fields["plan"].queryset.filter(
                pk=plan_id
            )
            plan = self.fields["plan"].queryset.first()
            if plan:
                self.fields["product"].queryset = Product.objects.filter(pk=plan.product_id)
                self.fields["build"].queryset = Build.objects.filter(
                    version_id=plan.product_version_id, is_active=True
                )
            else:
                self.fields["product"].queryset = Product.objects.none()
                self.fields["build"].queryset = Build.objects.none()
        else:
            # these are dynamically filtered via JavaScript
            self.fields["plan"].queryset = self.fields["plan"].queryset.none()
            self.fields["build"].queryset = Build.objects.none()

        self.fields["case"].queryset = TestCase.objects.filter(
            case_status__is_confirmed=True,
            **({"id_suite__id_project_id": project_id} if project_id else {}),
        )


class SearchRunForm(forms.ModelForm):
    class Meta:
        model = TestRun
        fields = "__all__"

    # overriden widget
    manager = UserField()
    default_tester = UserField()

    # extra fields
    product = forms.ModelChoiceField(queryset=Product.objects.all(), required=False)
    version = forms.ModelChoiceField(queryset=Version.objects.none(), required=False)
    running = forms.IntegerField(required=False)

    def populate(self, product_id=None):
        if product_id:
            self.fields["version"].queryset = Version.objects.filter(
                product__pk=product_id
            )
            self.fields["build"].queryset = Build.objects.filter(
                version__product=product_id
            )
