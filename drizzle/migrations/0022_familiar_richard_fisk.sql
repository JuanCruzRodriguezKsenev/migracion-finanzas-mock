CREATE TABLE "card_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"currency" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_id" uuid,
	"linked_account_id" uuid,
	"label" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"network" varchar(20) NOT NULL,
	"last_four" varchar(4) NOT NULL,
	"expiry_month" integer NOT NULL,
	"expiry_year" integer NOT NULL,
	"credit_limit" bigint,
	"closing_day" integer,
	"due_day" integer,
	"interest_rate_financing" integer,
	"interest_rate_penalty" integer,
	"monthly_maintenance_fee" bigint DEFAULT 0 NOT NULL,
	"annual_renewal_fee" bigint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_accounts" ADD CONSTRAINT "card_accounts_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_accounts" ADD CONSTRAINT "card_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_entity_id_financial_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."financial_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_accounts_card_currency_unique" ON "card_accounts" USING btree ("card_id","currency");--> statement-breakpoint
CREATE INDEX "cards_org_label_idx" ON "cards" USING btree ("organization_id","label");