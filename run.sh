#!/usr/bin/env bash
# Usage: ./run.sh <manage.py args>   e.g. ./run.sh runserver
set -e
cd "$(dirname "$0")"
export PYTHONPATH="$PWD:$PWD/Kiwi"
export DJANGO_SETTINGS_MODULE=kiwi_local_settings
exec uv run --no-project --python .venv/bin/python Kiwi/manage.py "${@:-runserver}"
