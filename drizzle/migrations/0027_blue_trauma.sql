CREATE TABLE "card_installment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"merchant_name" varchar(150),
	"category_id" uuid,
	"installment_amount" bigint NOT NULL,
	"total_installments" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'ARS' NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"first_installment_date" date NOT NULL,
	"resolved_through" date,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_installment_plans" ADD CONSTRAINT "card_installment_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_installment_plans" ADD CONSTRAINT "card_installment_plans_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_installment_plans" ADD CONSTRAINT "card_installment_plans_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_installment_plans_org_card_idx" ON "card_installment_plans" USING btree ("organization_id","card_id");