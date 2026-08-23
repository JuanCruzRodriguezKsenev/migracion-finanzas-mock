CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'ARS' NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"next_payment_date" timestamp with time zone NOT NULL,
	"auto_debit" boolean DEFAULT false NOT NULL,
	"account_id" uuid,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"logo_key" varchar(500) DEFAULT 'default' NOT NULL,
	"color" varchar(7) DEFAULT '#EEF2FF' NOT NULL,
	"category" varchar(30) DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;