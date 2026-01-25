CREATE TYPE "public"."log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"universe_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"universe_id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" bigint NOT NULL,
	"level" "log_level" NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_universe_id_games_universe_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."games"("universe_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_universe_id_games_universe_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."games"("universe_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "logs_universe_idx" ON "logs" USING btree ("universe_id");--> statement-breakpoint
CREATE INDEX "logs_time_idx" ON "logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "logs_universe_time_idx" ON "logs" USING btree ("universe_id","timestamp");