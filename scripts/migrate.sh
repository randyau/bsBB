#!/bin/bash
# Run Drizzle migrations.
#
# Usage:
#   npm run db:migrate              # dev: runs directly (drizzle-kit must be installed)
#   npm run db:migrate              # prod: auto-detects Docker and delegates to container
#   bash scripts/migrate.sh --docker   # force run via docker compose exec
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"

# ------------------------------------------------------------------
# If --docker flag passed, or drizzle-kit is not locally available,
# and a prod compose file + running app container exist → delegate.
# ------------------------------------------------------------------
FORCE_DOCKER=false
if [ "${1:-}" = "--docker" ]; then
  FORCE_DOCKER=true
fi

if $FORCE_DOCKER || ! node -e "require('drizzle-kit')" 2>/dev/null; then
  if [ -f "$COMPOSE_FILE" ]; then
    # Check if the app container is running
    RUNNING=$(docker compose -f "$COMPOSE_FILE" ps --status running --services 2>/dev/null | grep -c "^app$" || true)
    if [ "$RUNNING" -gt 0 ]; then
      echo "drizzle-kit not found locally — running migration inside app container..."
      docker compose -f "$COMPOSE_FILE" exec app bash scripts/migrate.sh
      exit $?
    fi
  fi
fi

# ------------------------------------------------------------------
# Run directly (dev environment or inside-container execution)
# ------------------------------------------------------------------
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://forum:forum@localhost:5432/forum"
fi

echo "Running migrations against: $DATABASE_URL"
cd "$PROJECT_ROOT"
if npx drizzle-kit migrate; then
  echo "✓ Migrations complete."
else
  echo "✗ Migration failed — check output above." >&2
  exit 1
fi
