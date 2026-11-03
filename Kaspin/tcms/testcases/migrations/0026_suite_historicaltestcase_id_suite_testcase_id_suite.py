import django.db.models.deletion
import tcms.core.models.base
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("management", "0016_persisted_project_testcase_codes"),
        ("testcases", "0025_alter_bugsystem_api_url_alter_bugsystem_base_url"),
    ]

    operations = [
        migrations.CreateModel(
            name="Suite",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("parent_suite", models.ForeignKey(blank=True, db_column="parent_suite", null=True, on_delete=django.db.models.deletion.CASCADE, related_name="child_suites", to="testcases.suite")),
                ("id_project", models.ForeignKey(db_column="id_project", on_delete=django.db.models.deletion.CASCADE, related_name="suites", to="management.project")),
            ],
            options={"ordering": ["title", "pk"]},
            bases=(models.Model, tcms.core.models.base.UrlMixin),
        ),
        migrations.AddField(
            model_name="testcase",
            name="id_suite",
            field=models.ForeignKey(blank=True, db_column="id_suite", null=True, on_delete=django.db.models.deletion.PROTECT, related_name="testcases", to="testcases.suite"),
        ),
        migrations.AddField(
            model_name="historicaltestcase",
            name="id_suite",
            field=models.ForeignKey(blank=True, db_column="id_suite", db_constraint=False, null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name="+", to="testcases.suite"),
        ),
        migrations.AddField(
            model_name="testcase",
            name="case_code",
            field=models.CharField(blank=True, default=None, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="historicaltestcase",
            name="case_code",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AlterField(
            model_name="testcase",
            name="category",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="category_case", to="testcases.category"),
        ),
        migrations.AddConstraint(
            model_name="suite",
            constraint=models.UniqueConstraint(condition=models.Q(("parent_suite__isnull", True)), fields=("id_project",), name="unique_project_root_suite"),
        ),
    ]
