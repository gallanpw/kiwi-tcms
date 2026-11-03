"""Small JSON API for projects and the project test-case tree."""

import json

from django.contrib.auth.decorators import login_required
from django.contrib.auth.decorators import permission_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from tcms.management.models import Project
from tcms.testcases.models import Suite, TestCase
from tcms.testcases.services import PROJECT_ROOT_TITLE, ensure_project_root


def _body(request):
    try:
        data = json.loads(request.body or b"{}")
    except (TypeError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _project_json(project):
    return {
        "id": project.pk,
        "logo": project.logo,
        "name": project.name,
        "code": project.code,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


@login_required
@require_http_methods(["GET", "POST"])
def projects(request):
    if request.method == "GET":
        return JsonResponse({"projects": [_project_json(p) for p in Project.objects.all()]})

    data = _body(request)
    if data is None:
        return JsonResponse({"error": "Body JSON tidak valid."}, status=400)
    name, code = str(data.get("name", "")).strip(), str(data.get("code", "")).strip()
    if not name or not code:
        return JsonResponse({"error": "Name dan Code wajib diisi."}, status=400)
    if Project.objects.filter(code=code).exists():
        return JsonResponse({"error": "Code project sudah digunakan."}, status=409)
    project = Project.objects.create(
        name=name, code=code, logo=str(data.get("logo") or "").strip()
    )
    ensure_project_root(project)
    return JsonResponse(_project_json(project), status=201)


@login_required
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def project_detail(request, project_id):
    project = get_object_or_404(Project, pk=project_id)
    if request.method == "GET":
        return JsonResponse(_project_json(project))
    if request.method == "DELETE":
        if project.suites.filter(testcases__isnull=False).exists():
            return JsonResponse(
                {"error": "Hapus testcase project sebelum menghapus project."},
                status=409,
            )
        project.delete()
        return JsonResponse({"deleted": True})
    data = _body(request)
    if data is None:
        return JsonResponse({"error": "Body JSON tidak valid."}, status=400)
    name = str(data.get("name", project.name)).strip()
    code = str(data.get("code", project.code)).strip()
    if not name or not code:
        return JsonResponse({"error": "Name dan Code wajib diisi."}, status=400)
    if Project.objects.exclude(pk=project.pk).filter(code=code).exists():
        return JsonResponse({"error": "Code project sudah digunakan."}, status=409)
    project.name = name
    project.code = code
    if "logo" in data:
        project.logo = str(data.get("logo") or "").strip()
    project.save()
    return JsonResponse(_project_json(project))


def _suite_json(suite):
    return {
        "id": suite.pk,
        "title": suite.title,
        "parent_suite": suite.parent_suite_id,
        "id_project": suite.id_project_id,
        "description": suite.description,
        "testcase_count": suite.testcases.count(),
    }


@login_required
@require_http_methods(["GET"])
def project_testcases(request, project_code):
    project = get_object_or_404(Project, code=project_code)
    suites = Suite.objects.filter(id_project=project).order_by("title", "pk")
    cases = (
        TestCase.objects.filter(id_suite__id_project=project)
        .select_related("id_suite")
        .order_by("pk")
    )
    return JsonResponse(
        {
            "project": _project_json(project),
            "suites": [_suite_json(suite) for suite in suites],
            "testcases": [
                {
                    "id": case.pk,
                    "case_code": case.case_code,
                    "summary": case.summary,
                    "id_suite": case.id_suite_id,
                }
                for case in cases
            ],
        }
    )


@login_required
@require_http_methods(["POST"])
def suites(request):
    data = _body(request)
    if data is None:
        return JsonResponse({"error": "Body JSON tidak valid."}, status=400)
    project = get_object_or_404(Project, pk=data.get("id_project"))
    title = str(data.get("title", "")).strip()
    if not title:
        return JsonResponse({"error": "Title wajib diisi."}, status=400)
    root = ensure_project_root(project)
    parent_id = data.get("parent_suite") or root.pk
    parent = get_object_or_404(Suite, pk=parent_id, id_project=project)
    suite = Suite.objects.create(
        title=title,
        parent_suite=parent,
        id_project=project,
        description=str(data.get("description", "")),
    )
    return JsonResponse(_suite_json(suite), status=201)


@login_required
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def suite_detail(request, suite_id):
    suite = get_object_or_404(Suite.objects.select_related("id_project"), pk=suite_id)
    if request.method == "GET":
        return JsonResponse(_suite_json(suite))
    if request.method == "DELETE":
        if suite.parent_suite_id is None:
            return JsonResponse({"error": "Project root tidak dapat dihapus."}, status=400)
        if suite.testcases.exists():
            return JsonResponse({"error": "Pindahkan testcase sebelum menghapus suite."}, status=409)
        if suite.child_suites.exists():
            return JsonResponse({"error": "Pindahkan child suite sebelum menghapus suite."}, status=409)
        suite.delete()
        return JsonResponse({"deleted": True})
    data = _body(request)
    if data is None:
        return JsonResponse({"error": "Body JSON tidak valid."}, status=400)
    title = str(data.get("title", suite.title)).strip()
    if not title:
        return JsonResponse({"error": "Title wajib diisi."}, status=400)
    if suite.parent_suite_id is None:
        if data.get("parent_suite") not in (None, suite.pk):
            return JsonResponse({"error": "Project root tidak dapat dipindahkan."}, status=400)
        parent = None
    else:
        parent_id = data.get("parent_suite", suite.parent_suite_id)
        parent = get_object_or_404(Suite, pk=parent_id, id_project=suite.id_project) if parent_id else ensure_project_root(suite.id_project)
    if parent and parent.pk == suite.pk:
        return JsonResponse({"error": "Parent suite tidak valid."}, status=400)
    suite.title = PROJECT_ROOT_TITLE if suite.parent_suite_id is None else title
    suite.parent_suite = parent
    suite.description = str(data.get("description", suite.description))
    suite.full_clean()
    suite.save()
    return JsonResponse(_suite_json(suite))


@login_required
@permission_required("testcases.delete_testcase", raise_exception=True)
@require_http_methods(["DELETE"])
def delete_testcase(request, project_code, case_id):
    case = get_object_or_404(
        TestCase,
        pk=case_id,
        id_suite__id_project__code=project_code,
    )
    case.delete()
    return JsonResponse({"deleted": True})
