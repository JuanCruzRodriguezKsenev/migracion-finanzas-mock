CREATE TABLE "holder_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"grantor_user_id" uuid NOT NULL,
	"grantee_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "holder_authorizations_distintos_check" CHECK ("holder_authorizations"."grantor_user_id" <> "holder_authorizations"."grantee_user_id")
);
--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "holder_user_id" uuid;--> statement-breakpoint
ALTER TABLE "holder_authorizations" ADD CONSTRAINT "holder_authorizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holder_authorizations" ADD CONSTRAINT "holder_authorizations_grantor_user_id_users_id_fk" FOREIGN KEY ("grantor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holder_authorizations" ADD CONSTRAINT "holder_authorizations_grantee_user_id_users_id_fk" FOREIGN KEY ("grantee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "holder_authorizations_org_grantor_grantee_active_unique" ON "holder_authorizations" USING btree ("organization_id","grantor_user_id","grantee_user_id") WHERE "holder_authorizations"."revoked_at" IS NULL;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_holder_user_id_users_id_fk" FOREIGN KEY ("holder_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_tx_org_holder_idx" ON "ledger_transactions" USING btree ("organization_id","holder_user_id");