CREATE TABLE "common_pot_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"amount_in_cents" bigint NOT NULL,
	"currency" varchar(10) NOT NULL,
	"note" varchar(200),
	"registered_by_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "common_pot_contributions_amount_check" CHECK ("common_pot_contributions"."amount_in_cents" <> 0)
);
--> statement-breakpoint
ALTER TABLE "common_pot_contributions" ADD CONSTRAINT "common_pot_contributions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "common_pot_contributions" ADD CONSTRAINT "common_pot_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "common_pot_contributions" ADD CONSTRAINT "common_pot_contributions_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "common_pot_contributions_org_currency_idx" ON "common_pot_contributions" USING btree ("organization_id","currency");