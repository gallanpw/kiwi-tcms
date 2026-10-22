#!/usr/bin/env bash
# Usage: deploy/pythonanywhere/manage.sh <manage.py args>   e.g. migrate
# manage.py wrapper for the PythonAnywhere Bash console (settings: kiwi_pa_settings.py).
set -e
cd "$(dirname "$0")/../.."
export PYTHONPATH="$PWD:$PWD/Kiwi:$PWD/deploy/pythonanywhere"
export DJANGO_SETTINGS_MODULE=kiwi_pa_settings
exec .venv/bin/python Kiwi/manage.py "$@"
