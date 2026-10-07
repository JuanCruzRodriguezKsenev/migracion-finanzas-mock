CREATE TABLE "agreement_percentages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"percentage_bp" integer NOT NULL,
	CONSTRAINT "agreement_percentages_bp_check" CHECK ("agreement_percentages"."percentage_bp" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "expense_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"debtor_user_id" uuid,
	"amount_in_cents" bigint NOT NULL,
	"currency" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_splits_amount_check" CHECK ("expense_splits"."amount_in_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "monthly_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount_in_cents" bigint NOT NULL,
	CONSTRAINT "monthly_contributions_month_check" CHECK ("monthly_contributions"."month" BETWEEN 1 AND 12),
	CONSTRAINT "monthly_contributions_amount_check" CHECK ("monthly_contributions"."amount_in_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "organization_agreements" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"mode" varchar(30) NOT NULL,
	"uses_common_pot" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_agreements_mode_check" CHECK ("organization_agreements"."mode" IN ('none','fixed_percentages','monthly_contributions'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "transaction_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_common_pot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agreement_percentages" ADD CONSTRAINT "agreement_percentages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_percentages" ADD CONSTRAINT "agreement_percentages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_debtor_user_id_users_id_fk" FOREIGN KEY ("debtor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_contributions" ADD CONSTRAINT "monthly_contributions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_contributions" ADD CONSTRAINT "monthly_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_agreements" ADD CONSTRAINT "organization_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_agreements" ADD CONSTRAINT "organization_agreements_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_percentages_org_user_unique" ON "agreement_percentages" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_splits_tx_debtor_unique" ON "expense_splits" USING btree ("transaction_id","debtor_user_id");--> statement-breakpoint
CREATE INDEX "expense_splits_org_debtor_idx" ON "expense_splits" USING btree ("organization_id","debtor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_contributions_org_user_month_unique" ON "monthly_contributions" USING btree ("organization_id","user_id","year","month");