#!/usr/bin/env bash
# Collect the static files and pack them in data/kiwi-static.tar.gz.
# Run by build_static_src.sh after the frontend bundle is built (see 'Setup' in README.md).
# Only runtime npm packages are collected (about 100 MB instead of 195 MB).
set -euo pipefail
cd "$(dirname "$0")/../.."
root="$PWD"

if [ ! -f Kiwi/tcms/static/js/bundle.js ]; then
    echo "build_static.sh: Kiwi/tcms/static/js/bundle.js missing, run webpack first (see README.md)" >&2
    exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cp Kiwi/tcms/package.json Kiwi/tcms/pnpm-lock.yaml "$work/"
cp config/pnpm-workspace.yaml "$work/"
(cd "$work" && pnpm install --prod)

cat > "$work/collect_settings.py" <<EOF
from kiwi_local_settings import *  # noqa: F403

STATIC_ROOT = "$work/static"
STATICFILES_DIRS = [d for d in STATICFILES_DIRS if not d.endswith("node_modules")]  # noqa: F405
STATICFILES_DIRS.append("$work/node_modules")
EOF

PYTHONPATH="$work:$root:$root/Kiwi" DJANGO_SETTINGS_MODULE=collect_settings \
    .venv/bin/python Kiwi/manage.py collectstatic --noinput

mkdir -p data
tar -C "$work" -czf data/kiwi-static.tar.gz static
ls -lh data/kiwi-static.tar.gz
