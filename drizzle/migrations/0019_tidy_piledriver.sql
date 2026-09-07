CREATE TABLE "contact_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"financial_entity_id" uuid NOT NULL,
	"type" varchar(20) DEFAULT 'wallet' NOT NULL,
	"cbu_cvu" varchar(22),
	"alias" varchar(20),
	"holder_name" varchar(150),
	"holder_tax_id" varchar(20),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cbu_cvu" varchar(22);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "alias" varchar(20);--> statement-breakpoint
ALTER TABLE "contact_payment_methods" ADD CONSTRAINT "contact_payment_methods_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_payment_methods" ADD CONSTRAINT "contact_payment_methods_financial_entity_id_financial_entities_id_fk" FOREIGN KEY ("financial_entity_id") REFERENCES "public"."financial_entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_payment_methods_contact_id_idx" ON "contact_payment_methods" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contacts_org_name_idx" ON "contacts" USING btree ("organization_id","name");