#!/bin/bash
# Run Drizzle migrations. Works from WSL dev environment or via docker exec.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export PATH="/home/agi/.nvm/versions/node/v24.14.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

if [ -z "$DATABASE_URL" ]; then
  # Default for local dev (db container exposed on localhost:5432)
  export DATABASE_URL="postgresql://forum:forum@localhost:5432/forum"
fi

echo "Running migrations against: $DATABASE_URL"
cd "$PROJECT_ROOT"
npx drizzle-kit migrate
echo "Migrations complete."
