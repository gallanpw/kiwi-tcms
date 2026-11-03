import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from tcms.management.models import Project


class TestProjectAPI(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="project-api-user",
            password="test-password",
        )
        self.client.login(username=self.user.username, password="test-password")

    def test_create_project_without_logo_uses_empty_string(self):
        response = self.client.post(
            reverse("api-projects"),
            data=json.dumps({"name": "Project without logo", "code": "NOLOGO"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        project = Project.objects.get(code="NOLOGO")
        self.assertEqual(project.logo, "")

    def test_update_project_can_clear_logo(self):
        project = Project.objects.create(
            name="Project with logo",
            code="WITHLOGO",
            logo="https://example.com/logo.png",
        )
        response = self.client.patch(
            reverse("api-project-detail", kwargs={"project_id": project.pk}),
            data=json.dumps({"logo": ""}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.logo, "")
