CREATE TYPE "public"."platform" AS ENUM('YOUTUBE', 'INSTAGRAM', 'LINKEDIN', 'X');--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"scope" text,
	"token_expires_at" timestamp with time zone,
	"connected_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_connected_by_id_users_id_fk" FOREIGN KEY ("connected_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_ws_platform_account_uq" ON "platform_connections" USING btree ("workspace_id","platform","platform_account_id");--> statement-breakpoint
CREATE INDEX "platform_connections_ws_idx" ON "platform_connections" USING btree ("workspace_id");