CREATE TABLE "payment_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"amount_in_cents" bigint NOT NULL,
	"currency" varchar(10) NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "payment_claims_amount_check" CHECK ("payment_claims"."amount_in_cents" > 0),
	CONSTRAINT "payment_claims_status_check" CHECK ("payment_claims"."status" IN ('pending','confirmed','rejected','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "claim_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_claims_pending_unique" ON "payment_claims" USING btree ("organization_id","from_user_id","to_user_id","currency") WHERE "payment_claims"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "payment_claims_org_to_status_idx" ON "payment_claims" USING btree ("organization_id","to_user_id","status");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_claim_id_payment_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."payment_claims"("id") ON DELETE cascade ON UPDATE no action;