from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from tcms.management.models import Project


@login_required
def projects_page(request):
    return render(request, "projects.html")


@login_required
def project_testcases_page(request, project_code):
    project = Project.objects.filter(code=project_code).first()
    if not project:
        return redirect("projects-list")
    return render(request, "project_testcases.html", {"project": project})
