#!/bin/bash

echo "🔒 Locking thread and checking OG metadata..."

# Get container ID
CONTAINER_ID=$(docker compose -f docker/docker-compose.dev.yml ps -q db)

if [ -z "$CONTAINER_ID" ]; then
  echo "❌ Error: Database container not found"
  exit 1
fi

echo "📦 Using container: $CONTAINER_ID"
echo ""

# Lock the thread and check OG metadata
sudo docker exec "$CONTAINER_ID" psql -U forum -d forum << 'EOF'
-- Lock the thread
UPDATE threads
SET is_locked = true
WHERE slug = 'repeat-2'
AND forum_id = (SELECT id FROM forums WHERE slug = 'general')
RETURNING id, title, slug, is_locked;

-- Check OG metadata for posts in that thread
SELECT
  p.id,
  substring(p.body_markdown, 1, 40) as body_preview,
  p.link_metadata
FROM posts p
WHERE p.thread_id = (
  SELECT id FROM threads
  WHERE slug = 'repeat-2'
  AND forum_id = (SELECT id FROM forums WHERE slug = 'general')
)
ORDER BY p.created_at;
EOF

echo ""
echo "✓ Done! Thread is now locked."
