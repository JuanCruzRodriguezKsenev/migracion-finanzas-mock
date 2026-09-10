ALTER TABLE "subscriptions" ADD COLUMN "resolved_through" date;--> statement-breakpoint

-- Backfill para suscripciones mensuales: puntero en la última ocurrencia anterior al período en curso (RFC 023 §3.4)
UPDATE "subscriptions"
SET "resolved_through" = (
  DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date
  + (LEAST(
      EXTRACT(DAY FROM "start_date")::int,
      EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::date)::int
    ) - 1) * INTERVAL '1 day'
)::date
WHERE "frequency" = 'monthly' AND "resolved_through" IS NULL;--> statement-breakpoint

-- Backfill para suscripciones anuales con cobro inicial ya transcurrido
UPDATE "subscriptions"
SET "resolved_through" = "start_date"::date
WHERE "frequency" = 'yearly' AND "start_date" <= CURRENT_DATE AND "resolved_through" IS NULL;--> statement-breakpoint

-- Fallback general para otras frecuencias o registros residuales
UPDATE "subscriptions"
SET "resolved_through" = ("start_date" - INTERVAL '1 month')::date
WHERE "resolved_through" IS NULL;