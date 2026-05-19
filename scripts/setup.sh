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
  echo ""
  echo "This setup script will generate a NEW database password. If you have an"
  echo "existing database, you MUST delete its Docker volume or the new password"
  echo "will not match. Otherwise, the app will fail to connect."
  echo ""
  echo "To delete the volume (destroys all forum data):"
  echo "  docker compose -f docker-compose.prod.yml down -v"
  echo ""
  read -rp "Overwrite .env and continue? This will replace all existing config. [y/N] " confirm
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
KEYPAIR_LINES=$(node "$SCRIPT_DIR/gen-keypair.js")
PRIVATE_JWK=$(echo "$KEYPAIR_LINES" | grep "^ATPROTO_PRIVATE_KEY=" | cut -d'=' -f2-)
PUBLIC_JWK=$(echo "$KEYPAIR_LINES" | grep "^ATPROTO_PUBLIC_KEY=" | cut -d'=' -f2-)
echo "  Keypair generated."

# ---------------------------------------------------------------------------
# Prompt for config
# ---------------------------------------------------------------------------
echo ""
read -rp "Public base URL (e.g. https://yourforum.com): " PUBLIC_BASE_URL
PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}" # strip trailing slash

# Extract domain from URL for Caddy and ALLOWED_HOSTS
DOMAIN=$(echo "$PUBLIC_BASE_URL" | sed 's|https\?://||' | cut -d'/' -f1)

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
read -rp "Admin email (receives moderation alerts): " ADMIN_EMAIL

echo ""
read -rp "Default forum visibility [public/members-only] (default: public): " DEFAULT_VISIBILITY
DEFAULT_VISIBILITY="${DEFAULT_VISIBILITY:-public}"
if [[ "$DEFAULT_VISIBILITY" != "public" && "$DEFAULT_VISIBILITY" != "members-only" ]]; then
  echo "Invalid choice. Defaulting to 'public'."
  DEFAULT_VISIBILITY="public"
fi

# ---------------------------------------------------------------------------
# Generate secrets
# ---------------------------------------------------------------------------
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 24)

# ---------------------------------------------------------------------------
# Generate client-metadata.json (served as static file by Caddy)
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
console.log('  client-metadata.json written to docker/caddy-static/');
"

# ---------------------------------------------------------------------------
# Write .env
# ---------------------------------------------------------------------------
cat > "$ENV_FILE" <<EOF
# ATproto OAuth Client
ATPROTO_CLIENT_ID=${CLIENT_ID}
ATPROTO_PRIVATE_KEY=$(echo "$PRIVATE_JWK" | tr -d '\n')
ATPROTO_PUBLIC_KEY=$(echo "$PUBLIC_JWK" | tr -d '\n')

# ATproto Service/Notification Account
ATPROTO_SERVICE_HANDLE=${ATPROTO_SERVICE_HANDLE}
ATPROTO_SERVICE_APP_PASSWORD=${ATPROTO_SERVICE_APP_PASSWORD}

# SMTP Email
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}
ADMIN_EMAIL=${ADMIN_EMAIL}

# Database
DATABASE_URL=postgresql://forum:${DB_PASSWORD}@db:5432/forum
DB_USER=forum
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=forum

# Sessions & Encryption
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# App
PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
DOMAIN=${DOMAIN}
ALLOWED_HOSTS=${DOMAIN}
NODE_ENV=production
SETUP_COMPLETE=true
DEFAULT_FORUM_VISIBILITY=${DEFAULT_VISIBILITY}
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
echo ""
echo " Next steps:"
echo "   1. docker compose -f docker-compose.prod.yml up -d"
echo "      (starts app, worker, database, and Caddy reverse proxy)"
echo ""
echo "   2. Once services are running, run migrations:"
echo "      docker compose -f docker-compose.prod.yml exec app npm run db:migrate"
echo ""
echo "   3. Visit https://${DOMAIN} and sign in with Bluesky."
echo "      The first user to log in is automatically promoted to admin."
echo ""
echo "   Config saved to: $ENV_FILE"
echo "   Full setup log: $LOG_FILE"
echo "========================================"
