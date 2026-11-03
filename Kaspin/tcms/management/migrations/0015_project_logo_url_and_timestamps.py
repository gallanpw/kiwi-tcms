from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("management", "0014_project")]

    operations = [
        migrations.AddField(
            model_name="project",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, null=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="project",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="project",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AlterField(
            model_name="project",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
