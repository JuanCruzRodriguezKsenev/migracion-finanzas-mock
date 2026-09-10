-- Backfill para suscripciones semanales: puntero en la última ocurrencia estrictamente anterior a la ocurrencia en curso (RFC 023 §3.4)
UPDATE "subscriptions"
SET "resolved_through" = (
  CASE
    WHEN "start_date"::date > CURRENT_DATE THEN
      ("start_date"::date - (7 * COALESCE(NULLIF("interval_count", 0), 1)) * INTERVAL '1 day')::date
    ELSE
      GREATEST(
        ("start_date"::date - (7 * COALESCE(NULLIF("interval_count", 0), 1)) * INTERVAL '1 day')::date,
        ("start_date"::date + (FLOOR((CURRENT_DATE - "start_date"::date)::numeric / (7 * COALESCE(NULLIF("interval_count", 0), 1)))::int - 1) * (7 * COALESCE(NULLIF("interval_count", 0), 1)) * INTERVAL '1 day')::date
      )
  END
)
WHERE "frequency" = 'weekly';--> statement-breakpoint

-- Backfill para suscripciones trimestrales: puntero en la última ocurrencia anterior a la ventana en curso
UPDATE "subscriptions"
SET "resolved_through" = (
  CASE
    WHEN "start_date"::date > CURRENT_DATE THEN
      ("start_date"::date - (3 * COALESCE(NULLIF("interval_count", 0), 1)) * INTERVAL '1 month')::date
    ELSE
      GREATEST(
        ("start_date"::date - (3 * COALESCE(NULLIF("interval_count", 0), 1)) * INTERVAL '1 month')::date,
        ("start_date"::date + (FLOOR(((EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM "start_date")::int) * 12 + (EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM "start_date")::int))::numeric / (3 * COALESCE(NULLIF("interval_count", 0), 1)))::int - 1) * (3 * COALESCE(NULLIF("interval_count", 0), 1)) * INTERVAL '1 month')::date
      )
  END
)
WHERE "frequency" = 'quarterly';--> statement-breakpoint

-- Backfill para suscripciones personalizadas (custom): puntero en la última ocurrencia anterior a la ventana en curso
UPDATE "subscriptions"
SET "resolved_through" = (
  CASE
    WHEN "start_date"::date > CURRENT_DATE THEN
      ("start_date"::date - COALESCE(NULLIF("interval_count", 0), 1) * INTERVAL '1 month')::date
    ELSE
      GREATEST(
        ("start_date"::date - COALESCE(NULLIF("interval_count", 0), 1) * INTERVAL '1 month')::date,
        ("start_date"::date + (FLOOR(((EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM "start_date")::int) * 12 + (EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM "start_date")::int))::numeric / COALESCE(NULLIF("interval_count", 0), 1))::int - 1) * COALESCE(NULLIF("interval_count", 0), 1) * INTERVAL '1 month')::date
      )
  END
)
WHERE "frequency" = 'custom';
