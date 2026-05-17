-- Add status column to posts table with post lifecycle states
-- States: active (normal), hidden (soft-deleted, can be restored), archived (old, inactive), deleted (permanently deleted, content cleared)
ALTER TABLE "posts" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint

-- Migrate existing is_deleted data to status
UPDATE "posts" SET "status" = 'hidden' WHERE "is_deleted" = true;
UPDATE "posts" SET "status" = 'active' WHERE "is_deleted" = false;
--> statement-breakpoint

-- Create index on status for efficient filtering
CREATE INDEX "posts_status_idx" ON "posts"("status");
