#!/usr/bin/env bash
# Run the Kaspin copy against the PostgreSQL database configured in .env.
set -e
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
    echo "run-kaspin.sh: .venv not found, see 'Setup' in README.md" >&2
    exit 1
fi
export PYTHONPATH="$PWD/Kaspin:$PWD"
export DJANGO_SETTINGS_MODULE=kiwi_local_settings
export KIWI_DB=postgres
if [ "$#" -eq 0 ]; then
    exec .venv/bin/python Kaspin/manage.py runserver 127.0.0.1:8001
fi
exec .venv/bin/python Kaspin/manage.py "$@"
