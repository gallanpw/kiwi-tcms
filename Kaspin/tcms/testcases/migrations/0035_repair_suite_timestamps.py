from django.db import migrations


def repair_suite_timestamps(apps, schema_editor):
    suite_model = apps.get_model("testcases", "Suite")
    table_name = suite_model._meta.db_table
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        if table_name not in connection.introspection.table_names(cursor):
            raise RuntimeError(f"Expected database table {table_name!r} to exist.")
        existing_columns = {
            column.name
            for column in connection.introspection.get_table_description(cursor, table_name)
        }

    for field_name in ("created_at", "updated_at"):
        field = suite_model._meta.get_field(field_name)
        if field.column not in existing_columns:
            schema_editor.add_field(suite_model, field)
            existing_columns.add(field.column)


class Migration(migrations.Migration):
    dependencies = [("testcases", "0034_alter_historicaltestcase_case_code")]

    operations = [
        migrations.RunPython(repair_suite_timestamps, migrations.RunPython.noop),
    ]
