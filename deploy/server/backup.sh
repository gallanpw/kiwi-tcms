#!/usr/bin/env bash
# Backup harian PostgreSQL Kiwi. Cron: 0 2 * * * /home/gallanwidyanto/kiwi-tcms/deploy/server/backup.sh
set -euo pipefail
APP="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${KIWI_BACKUP_DIR:-$HOME/kiwi-backups}"
KEEP_DAYS="${KIWI_BACKUP_KEEP_DAYS:-14}"

# ambil nilai dari .env tanpa meng-source (password boleh mengandung karakter khusus)
get() { grep -E "^$1=" "$APP/.env" | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

export PGPASSWORD="$(get KIWI_DB_PASSWORD)"
mkdir -p "$DEST"
OUT="$DEST/kiwi-$(date +%F-%H%M).sql.gz"
pg_dump -h "$(get KIWI_DB_HOST)" -p "$(get KIWI_DB_PORT)" -U "$(get KIWI_DB_USER)" "$(get KIWI_DB_NAME)" | gzip > "$OUT"
chmod 600 "$OUT"
find "$DEST" -name 'kiwi-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $OUT"
