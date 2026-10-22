#!/usr/bin/env bash
# Build static_src/ for Vercel: the frontend (webpack bundle plus runtime npm
# packages) collected at the laptop. Vercel has no bundle.js or node_modules, so
# its build-time collectstatic reads static_src/ (see kiwi_vercel_settings.py).
# Run after the frontend bundle is built (see 'Setup' in README.md), then commit static_src/.
set -euo pipefail
cd "$(dirname "$0")/../.."

# collects runtime-only static files into data/kiwi-static.tar.gz
deploy/pythonanywhere/build_static.sh

rm -rf static_src
mkdir static_src
tar -C static_src --strip-components=1 -xzf data/kiwi-static.tar.gz

# never served to a browser
find static_src -type f \( -name '*.map' -o -name '*.md' -o -name '*.ts' \
    -o -name '*.scss' -o -name '*.less' \) -delete

du -sh static_src
find static_src -type f | wc -l
