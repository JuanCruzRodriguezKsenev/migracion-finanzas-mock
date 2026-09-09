CREATE TABLE "category_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"currency" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "type" varchar(20);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "account_code" varchar(50);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_system_leaf" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "categories" SET "type" = 'revenue', "account_code" = '4.1.01.01' WHERE "name" = 'Sueldos y Honorarios';--> statement-breakpoint
UPDATE "categories" SET "type" = 'expense', "account_code" = '5.1.01.01' WHERE "name" = 'Supermercado y Alimentos';--> statement-breakpoint
UPDATE "categories" SET "type" = 'expense', "account_code" = '5.1.01.02' WHERE "name" = 'Servicios del Hogar';--> statement-breakpoint
UPDATE "categories" SET "type" = 'expense', "account_code" = '5.1.01.03' WHERE "name" = 'Alquiler y Expensas';--> statement-breakpoint
INSERT INTO "category_accounts" ("category_id", "account_id", "currency")
SELECT c."id", a."id", a."currency"
FROM "categories" c
JOIN "accounts" a ON a."organization_id" = c."organization_id"
  AND (
    (c."name" = 'Sueldos y Honorarios' AND a."code" LIKE '4.1.01.01%') OR
    (c."name" = 'Supermercado y Alimentos' AND a."code" LIKE '5.1.01.01%') OR
    (c."name" = 'Servicios del Hogar' AND a."code" LIKE '5.1.01.02%') OR
    (c."name" = 'Alquiler y Expensas' AND a."code" LIKE '5.1.01.03%')
  )
WHERE NOT EXISTS (
  SELECT 1 FROM "category_accounts" ca WHERE ca."category_id" = c."id" AND ca."account_id" = a."id"
);--> statement-breakpoint
UPDATE "categories" SET "parent_id" = NULL
WHERE "parent_id" IN (SELECT "id" FROM "categories" WHERE "name" IN ('Ingresos', 'Gastos'));--> statement-breakpoint
UPDATE "ledger_transactions" SET "category_id" = NULL
WHERE "category_id" IN (SELECT "id" FROM "categories" WHERE "name" IN ('Ingresos', 'Gastos'));--> statement-breakpoint
DELETE FROM "categories" WHERE "name" IN ('Ingresos', 'Gastos');--> statement-breakpoint
INSERT INTO "categories" ("organization_id", "name", "type", "account_code", "is_system_leaf")
SELECT DISTINCT a."organization_id", 'Gastos Generales', 'expense', '5.1.01.99', true
FROM "accounts" a
WHERE a."code" LIKE '5.1.01.99%'
  AND NOT EXISTS (
    SELECT 1 FROM "categories" c
    WHERE c."organization_id" = a."organization_id" AND c."account_code" = '5.1.01.99'
  );--> statement-breakpoint
INSERT INTO "category_accounts" ("category_id", "account_id", "currency")
SELECT c."id", a."id", a."currency"
FROM "accounts" a
JOIN "categories" c ON c."organization_id" = a."organization_id" AND c."account_code" = '5.1.01.99'
WHERE a."code" LIKE '5.1.01.99%'
  AND NOT EXISTS (
    SELECT 1 FROM "category_accounts" ca WHERE ca."category_id" = c."id" AND ca."account_id" = a."id"
  );--> statement-breakpoint
INSERT INTO "categories" ("organization_id", "name", "type", "account_code", "is_system_leaf")
SELECT DISTINCT a."organization_id", 'Ingresos Varios', 'revenue', '4.1.01.99', true
FROM "accounts" a
WHERE a."code" LIKE '4.1.01.99%'
  AND NOT EXISTS (
    SELECT 1 FROM "categories" c
    WHERE c."organization_id" = a."organization_id" AND c."account_code" = '4.1.01.99'
  );--> statement-breakpoint
INSERT INTO "category_accounts" ("category_id", "account_id", "currency")
SELECT c."id", a."id", a."currency"
FROM "accounts" a
JOIN "categories" c ON c."organization_id" = a."organization_id" AND c."account_code" = '4.1.01.99'
WHERE a."code" LIKE '4.1.01.99%'
  AND NOT EXISTS (
    SELECT 1 FROM "category_accounts" ca WHERE ca."category_id" = c."id" AND ca."account_id" = a."id"
  );--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "account_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "category_accounts" ADD CONSTRAINT "category_accounts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_accounts" ADD CONSTRAINT "category_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_accounts_category_currency_unique" ON "category_accounts" USING btree ("category_id","currency");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_org_account_code_unique" ON "categories" USING btree ("organization_id","account_code");--> statement-breakpoint
CREATE INDEX "categories_org_parent_idx" ON "categories" USING btree ("organization_id","parent_id");