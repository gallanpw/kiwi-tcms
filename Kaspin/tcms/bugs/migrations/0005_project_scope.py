import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("management", "0016_persisted_project_testcase_codes"),
        ("bugs", "0004_alter_severity_color"),
    ]

    operations = [
        migrations.AddField(
            model_name="bug",
            name="id_project",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="bugs", to="management.project"),
        ),
    ]
