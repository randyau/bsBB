CREATE TABLE IF NOT EXISTS "admin_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by_did" text NOT NULL REFERENCES "users"("did"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_assets_slug_unique" UNIQUE("slug")
);

CREATE INDEX IF NOT EXISTS "admin_assets_uploaded_by_did_idx" ON "admin_assets" ("uploaded_by_did");
CREATE INDEX IF NOT EXISTS "admin_assets_created_at_idx" ON "admin_assets" ("created_at");
