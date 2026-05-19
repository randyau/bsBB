CREATE TABLE IF NOT EXISTS "pii_removal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "posts"("id"),
	"requester_did" text NOT NULL REFERENCES "users"("did"),
	"reason" text NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"resolved_by_did" text REFERENCES "users"("did"),
	"resolved_at" timestamp with time zone,
	"dismiss_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pii_removal_requests_post_id_idx" ON "pii_removal_requests" ("post_id");
CREATE INDEX IF NOT EXISTS "pii_removal_requests_status_idx" ON "pii_removal_requests" ("status");
