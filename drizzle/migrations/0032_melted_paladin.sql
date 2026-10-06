CREATE TABLE "budget_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"effective_from" varchar(7) NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "budget_limits_amount_positive" CHECK ("budget_limits"."amount" > 0),
	CONSTRAINT "budget_limits_effective_from_format" CHECK ("budget_limits"."effective_from" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"currency" varchar(10) NOT NULL,
	"ended_from" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_ended_from_format" CHECK ("budgets"."ended_from" IS NULL OR "budgets"."ended_from" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_limits_budget_month_unique" ON "budget_limits" USING btree ("budget_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_active_category_currency_unique" ON "budgets" USING btree ("organization_id","category_id","currency") WHERE "budgets"."ended_from" IS NULL;