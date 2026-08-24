#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump "$DATABASE_URL" --format=custom --file="$OUT_DIR/hope-$STAMP.dump"
find "$OUT_DIR" -type f -name 'hope-*.dump' -mtime +14 -delete
printf '%s\n' "$OUT_DIR/hope-$STAMP.dump"
