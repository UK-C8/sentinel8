#!/usr/bin/env bash
# Run all migrations against the direct (non-pooled) Neon connection string.
# Usage: DATABASE_URL_DIRECT=<neon-direct-url> bash infra/migrate.sh
set -euo pipefail

if [[ -z "${DATABASE_URL_DIRECT:-}" ]]; then
  ENV_FILE="$(dirname "$0")/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
  fi
fi

if [[ -z "${DATABASE_URL_DIRECT:-}" ]]; then
  echo "Error: DATABASE_URL_DIRECT is not set. Use the non-pooled Neon connection string." >&2
  exit 1
fi

DB_DIR="$(dirname "$0")/../db"

echo "Running migrations against direct connection..."
for f in "$DB_DIR"/0*.sql; do
  echo "  → $f"
  psql "$DATABASE_URL_DIRECT" -f "$f"
done
echo "Done."
