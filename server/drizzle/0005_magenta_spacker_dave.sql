CREATE TYPE "public"."publish_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "visibility" "publish_visibility" DEFAULT 'private' NOT NULL;