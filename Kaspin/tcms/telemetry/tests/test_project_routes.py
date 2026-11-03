from django.contrib.auth import get_user_model
from django.test import TestCase

from tcms.management.models import Project


class TestProjectTelemetryRoutes(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="project-telemetry-user",
            password="test-password",
        )
        self.client.login(username=self.user.username, password="test-password")
        self.project = Project.objects.create(name="Project", code="PROJECT")

    def test_project_telemetry_routes_load_with_project_context(self):
        paths = (
            "breakdown",
            "execution/dashboard",
            "test-case-health",
        )
        for page in paths:
            with self.subTest(page=page):
                response = self.client.get(
                    f"/telemetry/{self.project.code}/testing/{page}/"
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.context["project"], self.project)
