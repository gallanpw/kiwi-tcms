from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("management", "0015_project_logo_url_and_timestamps")]

    operations = [
        migrations.AddField(
            model_name="project",
            name="next_testcase_number",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
