ALTER TABLE "users" ADD COLUMN "notification_type" text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_frequency" text DEFAULT 'immediate' NOT NULL;