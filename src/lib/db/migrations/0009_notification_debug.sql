-- Add error detail + retry tracking to notification_queue
ALTER TABLE "notification_queue"
  ADD COLUMN "error" text,
  ADD COLUMN "retry_count" integer NOT NULL DEFAULT 0;

-- Worker structured log (non-notification errors and info events)
CREATE TABLE "worker_log" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "level"      text NOT NULL,   -- 'info' | 'warn' | 'error'
  "message"    text NOT NULL,
  "context"    jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "worker_log_created" ON "worker_log" ("created_at" DESC);
CREATE INDEX "worker_log_level"   ON "worker_log" ("level", "created_at" DESC);
