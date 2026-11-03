#!/usr/bin/env bash
# Run the Kaspin copy against the PostgreSQL database configured in .env.
set -e
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
    echo "run-kaspin.sh: .venv not found, see 'Setup' in README.md" >&2
    exit 1
fi
frontend_dir="$PWD/Kaspin/tcms"
if [ ! -d "$frontend_dir/node_modules" ]; then
    if [ -d "$PWD/Kiwi/tcms/node_modules" ]; then
        ln -s "$PWD/Kiwi/tcms/node_modules" "$frontend_dir/node_modules"
    elif command -v npm >/dev/null 2>&1; then
        (cd "$frontend_dir" && npm ci)
    else
        echo "run-kaspin.sh: frontend dependencies missing; install Node.js/npm and run npm ci in Kaspin/tcms" >&2
        exit 1
    fi
fi
export PYTHONPATH="$PWD/Kaspin:$PWD"
export DJANGO_SETTINGS_MODULE=kiwi_local_settings
export KIWI_DB=postgres
if [ "$#" -eq 0 ]; then
    exec .venv/bin/python Kaspin/manage.py runserver 127.0.0.1:8001
fi
exec .venv/bin/python Kaspin/manage.py "$@"
