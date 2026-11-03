import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("management", "0016_persisted_project_testcase_codes"),
        ("testplans", "0011_alter_testplan_extra_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="testplan",
            name="id_project",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="testplans", to="management.project"),
        ),
        migrations.AddField(
            model_name="historicaltestplan",
            name="id_project",
            field=models.ForeignKey(blank=True, db_constraint=False, null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name="+", to="management.project"),
        ),
    ]
