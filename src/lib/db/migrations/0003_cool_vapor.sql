CREATE TABLE "thread_views" (
	"user_did" text NOT NULL,
	"thread_id" uuid NOT NULL,
	"last_viewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "thread_views_user_did_thread_id_pk" PRIMARY KEY("user_did","thread_id")
);
--> statement-breakpoint
ALTER TABLE "thread_views" ADD CONSTRAINT "thread_views_user_did_users_did_fk" FOREIGN KEY ("user_did") REFERENCES "public"."users"("did") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_views" ADD CONSTRAINT "thread_views_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;