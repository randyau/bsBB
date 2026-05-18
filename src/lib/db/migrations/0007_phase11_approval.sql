ALTER TABLE "forums" ADD COLUMN "require_approval_days" integer DEFAULT 0 NOT NULL;
ALTER TABLE "posts" ADD COLUMN "is_approved" boolean DEFAULT true NOT NULL;
ALTER TABLE "posts" ADD COLUMN "rejection_reason" text;
