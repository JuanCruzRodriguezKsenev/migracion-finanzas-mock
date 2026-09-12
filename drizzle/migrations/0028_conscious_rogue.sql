CREATE TABLE "loan_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"currency" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"entity_id" uuid,
	"contact_id" uuid,
	"principal_amount" bigint NOT NULL,
	"currency" varchar(10) DEFAULT 'ARS' NOT NULL,
	"interest_rate_annual" integer DEFAULT 0 NOT NULL,
	"total_installments" integer DEFAULT 1 NOT NULL,
	"frequency" varchar(20) DEFAULT 'monthly' NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"first_installment_date" date NOT NULL,
	"resolved_through" date,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_entity_id_financial_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."financial_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loan_accounts_loan_currency_unique" ON "loan_accounts" USING btree ("loan_id","currency");--> statement-breakpoint
CREATE INDEX "loans_org_direction_idx" ON "loans" USING btree ("organization_id","direction");