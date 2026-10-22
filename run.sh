#!/usr/bin/env bash
# Usage: ./run.sh <manage.py args>   e.g. ./run.sh runserver
# DB is chosen by KIWI_DB (sqlite|postgres) in .env, read by kiwi_local_settings.py.
# Runs .venv/bin/python directly, so it works for a venv made by either uv or pip.
set -e
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
    echo "run.sh: .venv not found, see 'Setup' in README.md" >&2
    exit 1
fi
export PYTHONPATH="$PWD:$PWD/Kiwi"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-kiwi_local_settings}"
exec .venv/bin/python Kiwi/manage.py "${@:-runserver}"
