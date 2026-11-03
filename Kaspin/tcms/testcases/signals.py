from django.db.models.signals import post_save

from tcms.management.models import Project
from tcms.testcases.services import ensure_project_root


def ensure_root_suite(sender, instance, created, **kwargs):
    if created:
        ensure_project_root(instance)


post_save.connect(ensure_root_suite, sender=Project, dispatch_uid="project_root_suite")
