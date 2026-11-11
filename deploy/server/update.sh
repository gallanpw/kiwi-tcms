#!/usr/bin/env bash
# Update aplikasi di server: Kiwi dan (bila ada) Kaspin Kiwi MCP.
# Jalankan dari mana saja: ~/kiwi-tcms/deploy/server/update.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

git pull
git submodule update --init --depth 1

export PYTHONPATH="$PWD:$PWD/Kiwi:$PWD/deploy/server" DJANGO_SETTINGS_MODULE=kiwi_prod_settings
.venv/bin/python Kiwi/manage.py migrate
.venv/bin/python Kiwi/manage.py collectstatic --noinput

# venv MCP terpisah dari venv Kiwi, supaya versi pustaka tidak saling bentrok.
# Selalu diperbarui, juga saat MCP sedang dimatikan, agar siap bila dinyalakan lagi.
if [ ! -x mcp/.venv/bin/python ]; then
    python3 -m venv mcp/.venv
fi
mcp/.venv/bin/pip install --quiet --upgrade ./mcp

# MCP ikut restart lewat PartOf=kiwi.service (hanya bila MCP sedang jalan).
sudo systemctl restart kiwi
systemctl is-active kiwi
systemctl is-active kiwi-mcp || echo "(kiwi-mcp tidak aktif; nyalakan dengan: sudo systemctl enable --now kiwi-mcp)"
