CREATE TABLE "user_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_did" text NOT NULL REFERENCES "users"("did") ON DELETE CASCADE,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "user_notifications_recipient_created" ON "user_notifications" ("recipient_did", "created_at" DESC);
CREATE INDEX "user_notifications_recipient_unread" ON "user_notifications" ("recipient_did", "is_read") WHERE is_read = false;
