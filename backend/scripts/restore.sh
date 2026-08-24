#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?backup file required}"
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$1"
