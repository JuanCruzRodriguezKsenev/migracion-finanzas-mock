ALTER TABLE "subscriptions" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Asegurar existencia de la hoja General (5.1.09.99) para el padre 5.1.09 si no estuviera creada
INSERT INTO "categories" ("organization_id", "parent_id", "name", "type", "account_code", "is_system_leaf")
SELECT c."organization_id", c."id", 'General', 'expense', '5.1.09.99', true
FROM "categories" c
WHERE c."account_code" = '5.1.09'
  AND NOT EXISTS (
    SELECT 1 FROM "categories" sub
    WHERE sub."organization_id" = c."organization_id" AND sub."account_code" = '5.1.09.99'
  );--> statement-breakpoint

-- 1. entertainment -> 5.1.09.01 (Entretenimiento)
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09.01'
  AND s."category" = 'entertainment';--> statement-breakpoint

-- 2. productivity -> 5.1.09.02 (Productividad)
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09.02'
  AND s."category" = 'productivity';--> statement-breakpoint

-- 3. design -> 5.1.09.03 (Diseño)
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09.03'
  AND s."category" = 'design';--> statement-breakpoint

-- 4. fitness -> 5.1.09.04 (Salud y fitness)
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09.04'
  AND s."category" = 'fitness';--> statement-breakpoint

-- 5. security -> 5.1.09.05 (Seguridad)
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09.05'
  AND s."category" = 'security';--> statement-breakpoint

-- 6. storage -> 5.1.09.06 (Almacenamiento)
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09.06'
  AND s."category" = 'storage';--> statement-breakpoint

-- 7. other -> 5.1.09.99 (General / Sin detallar)
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09.99'
  AND s."category" = 'other';--> statement-breakpoint

-- Fallback para cualquier otro valor residual hacia el padre 5.1.09
UPDATE "subscriptions" s
SET "category_id" = c."id"
FROM "categories" c
WHERE c."organization_id" = s."organization_id"
  AND c."account_code" = '5.1.09'
  AND s."category_id" IS NULL
  AND s."category" IS NOT NULL;--> statement-breakpoint

-- Borrar columna vieja tras backfill exitoso
ALTER TABLE "subscriptions" DROP COLUMN "category";--> statement-breakpoint

CREATE INDEX "subscriptions_category_idx" ON "subscriptions" USING btree ("category_id");
