CREATE TYPE "public"."post_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TABLE "post_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"caption" text,
	"publish_status" "post_status" DEFAULT 'DRAFT' NOT NULL,
	"published_url" text,
	"error_message" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"title" text,
	"media_url" text,
	"status" "post_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_targets_post_connection_uq" ON "post_targets" USING btree ("post_id","connection_id");--> statement-breakpoint
CREATE INDEX "post_targets_post_idx" ON "post_targets" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "posts_ws_idx" ON "posts" USING btree ("workspace_id");