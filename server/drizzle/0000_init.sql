CREATE SCHEMA "soulseer";
--> statement-breakpoint
CREATE TYPE "soulseer"."forum_category" AS ENUM('General', 'Readings', 'Spiritual Growth', 'Ask a Reader', 'Announcements');--> statement-breakpoint
CREATE TYPE "soulseer"."message_billing" AS ENUM('free', 'charged');--> statement-breakpoint
CREATE TYPE "soulseer"."payment_status" AS ENUM('pending', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "soulseer"."reading_status" AS ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "soulseer"."reading_type" AS ENUM('chat', 'voice', 'video');--> statement-breakpoint
CREATE TYPE "soulseer"."transaction_type" AS ENUM('top_up', 'reading_charge', 'reader_credit', 'payout', 'adjustment');--> statement-breakpoint
CREATE TYPE "soulseer"."user_role" AS ENUM('client', 'reader', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."forum_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"flag_count" integer DEFAULT 0 NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."forum_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer,
	"comment_id" integer,
	"reporter_id" integer NOT NULL,
	"reason" text NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."forum_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"category" "soulseer"."forum_category" DEFAULT 'General' NOT NULL,
	"flag_count" integer DEFAULT 0 NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"reader_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"body" text NOT NULL,
	"billing" "soulseer"."message_billing" DEFAULT 'free' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"unlocked" boolean DEFAULT true NOT NULL,
	"reading_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."newsletter_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_signups_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"type" "soulseer"."reading_type" NOT NULL,
	"status" "soulseer"."reading_status" DEFAULT 'pending' NOT NULL,
	"price_per_minute" integer NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration" integer DEFAULT 0 NOT NULL,
	"total_price" integer DEFAULT 0 NOT NULL,
	"payment_status" "soulseer"."payment_status" DEFAULT 'pending' NOT NULL,
	"chat_transcript" jsonb DEFAULT '[]'::jsonb,
	"rating" integer,
	"review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "soulseer"."transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reading_id" integer,
	"stripe_id" varchar(128),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soulseer"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth0_id" varchar(128),
	"email" varchar(320) NOT NULL,
	"username" varchar(64) NOT NULL,
	"full_name" varchar(128) NOT NULL,
	"role" "soulseer"."user_role" DEFAULT 'client' NOT NULL,
	"bio" text,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"profile_image" text,
	"pricing_chat" integer DEFAULT 0 NOT NULL,
	"pricing_voice" integer DEFAULT 0 NOT NULL,
	"pricing_video" integer DEFAULT 0 NOT NULL,
	"account_balance" integer DEFAULT 0 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"stripe_account_id" varchar(128),
	"stripe_customer_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth0_id_unique" UNIQUE("auth0_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."forum_comments" ADD CONSTRAINT "forum_comments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "soulseer"."forum_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."forum_comments" ADD CONSTRAINT "forum_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."forum_flags" ADD CONSTRAINT "forum_flags_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "soulseer"."forum_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."forum_flags" ADD CONSTRAINT "forum_flags_comment_id_forum_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "soulseer"."forum_comments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."forum_flags" ADD CONSTRAINT "forum_flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."forum_posts" ADD CONSTRAINT "forum_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."messages" ADD CONSTRAINT "messages_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."messages" ADD CONSTRAINT "messages_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."messages" ADD CONSTRAINT "messages_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "soulseer"."readings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."readings" ADD CONSTRAINT "readings_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."readings" ADD CONSTRAINT "readings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "soulseer"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soulseer"."transactions" ADD CONSTRAINT "transactions_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "soulseer"."readings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_category_idx" ON "soulseer"."forum_posts" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_created_idx" ON "soulseer"."forum_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_thread_idx" ON "soulseer"."messages" USING btree ("client_id","reader_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readings_reader_idx" ON "soulseer"."readings" USING btree ("reader_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readings_client_idx" ON "soulseer"."readings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readings_status_idx" ON "soulseer"."readings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_idx" ON "soulseer"."transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "soulseer"."transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "soulseer"."users" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_online_idx" ON "soulseer"."users" USING btree ("is_online");