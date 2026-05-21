#!/bin/bash
# Stamp drizzle.__drizzle_migrations for databases where the schema exists
# but the tracking table is empty. See scripts/stamp-migrations.ts for details.
#
# Usage:
#   npm run db:stamp
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"

# Delegate to app container if not running inside one
if ! node -e "require('drizzle-orm')" 2>/dev/null; then
  if [ -f "$COMPOSE_FILE" ]; then
    RUNNING=$(docker compose -f "$COMPOSE_FILE" ps --status running --services 2>/dev/null | grep -c "^app$" || true)
    if [ "$RUNNING" -gt 0 ]; then
      echo "drizzle-orm not found locally — running stamp inside app container..."
      docker compose -f "$COMPOSE_FILE" exec app bash scripts/stamp-migrations.sh
      exit $?
    fi
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://forum:forum@localhost:5432/forum"
fi

cd "$PROJECT_ROOT"
if npx tsx scripts/stamp-migrations.ts; then
  echo "✓ Stamp complete. Run npm run db:migrate to verify."
else
  echo "✗ Stamp failed — check output above." >&2
  exit 1
fi
