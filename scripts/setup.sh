#!/bin/bash
# bsBB First-Run Setup Script
# Run once on a fresh server to generate keys, configure the instance, and write .env
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/setup.log"
ENV_FILE="$PROJECT_ROOT/.env"

mkdir -p "$PROJECT_ROOT/logs"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================"
echo " bsBB Setup — $(date)"
echo "========================================"

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
echo ""
echo "Checking prerequisites..."
for cmd in node docker openssl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Please install it before running setup."
    exit 1
  fi
done
echo "  node: $(node --version)"
echo "  docker: $(docker --version)"
echo "  openssl: $(openssl version)"

# ---------------------------------------------------------------------------
# Check for existing .env
# ---------------------------------------------------------------------------
if [ -f "$ENV_FILE" ]; then
  echo ""
  echo "WARNING: .env already exists."
  read -rp "Overwrite? This will replace all existing config. [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborting."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Generate P-256 JWK keypair
# ---------------------------------------------------------------------------
echo ""
echo "Generating P-256 JWK keypair..."
KEYPAIR_JSON=$(node "$SCRIPT_DIR/gen-keypair.js")
PRIVATE_JWK=$(echo "$KEYPAIR_JSON" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).privateJwk))")
PUBLIC_JWK=$(echo "$KEYPAIR_JSON" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d).publicJwk)))")
echo "  Keypair generated."

# ---------------------------------------------------------------------------
# Prompt for config
# ---------------------------------------------------------------------------
echo ""
read -rp "Public base URL (e.g. https://yourforum.com): " PUBLIC_BASE_URL
PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}" # strip trailing slash

read -rp "ATproto service handle (e.g. notifications.yourforum.bsky.social): " ATPROTO_SERVICE_HANDLE
read -rsp "ATproto service app password (xxxx-xxxx-xxxx-xxxx): " ATPROTO_SERVICE_APP_PASSWORD
echo ""

read -rp "SMTP host: " SMTP_HOST
read -rp "SMTP port [587]: " SMTP_PORT
SMTP_PORT="${SMTP_PORT:-587}"
read -rp "SMTP user: " SMTP_USER
read -rsp "SMTP password: " SMTP_PASS
echo ""
read -rp "SMTP from address: " SMTP_FROM

echo ""
read -rp "Default forum visibility [public/members-only] (default: public): " DEFAULT_VISIBILITY
DEFAULT_VISIBILITY="${DEFAULT_VISIBILITY:-public}"
if [[ "$DEFAULT_VISIBILITY" != "public" && "$DEFAULT_VISIBILITY" != "members-only" ]]; then
  echo "Invalid choice. Defaulting to 'public'."
  DEFAULT_VISIBILITY="public"
fi

# ---------------------------------------------------------------------------
# Generate session secret
# ---------------------------------------------------------------------------
SESSION_SECRET=$(openssl rand -hex 32)

# ---------------------------------------------------------------------------
# Generate client-metadata.json
# ---------------------------------------------------------------------------
CLIENT_METADATA_DIR="$PROJECT_ROOT/docker/caddy-static"
mkdir -p "$CLIENT_METADATA_DIR"
CLIENT_ID="${PUBLIC_BASE_URL}/client-metadata.json"

node -e "
const pub = $PUBLIC_JWK;
const meta = {
  client_id: '$CLIENT_ID',
  client_name: 'bsBB Forum',
  client_uri: '$PUBLIC_BASE_URL',
  redirect_uris: ['${PUBLIC_BASE_URL}/callback'],
  scope: 'atproto transition:chat.bsky',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'private_key_jwt',
  token_endpoint_auth_signing_alg: 'ES256',
  jwks: { keys: [{ ...pub, use: 'sig', alg: 'ES256' }] },
  dpop_bound_access_tokens: true,
  application_type: 'web',
};
require('fs').writeFileSync('$CLIENT_METADATA_DIR/client-metadata.json', JSON.stringify(meta, null, 2));
console.log('  client-metadata.json written.');
"

# ---------------------------------------------------------------------------
# Write .env
# ---------------------------------------------------------------------------
cat > "$ENV_FILE" <<EOF
# ATproto OAuth Client
ATPROTO_CLIENT_ID=${CLIENT_ID}
ATPROTO_PRIVATE_KEY=$(echo "$PRIVATE_JWK" | tr -d '\n')

# ATproto Service/Notification Account
ATPROTO_SERVICE_HANDLE=${ATPROTO_SERVICE_HANDLE}
ATPROTO_SERVICE_APP_PASSWORD=${ATPROTO_SERVICE_APP_PASSWORD}

# SMTP Email
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}

# Database
DATABASE_URL=postgresql://forum:forum@db:5432/forum

# Sessions
SESSION_SECRET=${SESSION_SECRET}

# App
PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
NODE_ENV=production
SETUP_COMPLETE=true
EOF

echo ""
echo "  .env written."

# ---------------------------------------------------------------------------
# Validate ATproto service account (optional — warn on failure)
# ---------------------------------------------------------------------------
echo ""
echo "Validating ATproto service account..."
node -e "
const { BskyAgent } = require('@atproto/api');
const agent = new BskyAgent({ service: 'https://bsky.social' });
agent.login({ identifier: '$ATPROTO_SERVICE_HANDLE', password: '$ATPROTO_SERVICE_APP_PASSWORD' })
  .then(() => console.log('  ATproto service account: OK'))
  .catch(err => console.warn('  WARNING: Could not validate ATproto account:', err.message));
" 2>/dev/null || echo "  (Skipping validation — @atproto/api not available yet)"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo " Setup complete!"
echo " Next steps:"
echo "   1. docker compose up -d"
echo "   2. bash scripts/migrate.sh"
echo "   3. Log in with your Bluesky account — you'll be auto-promoted to admin."
echo "========================================"
