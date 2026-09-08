ALTER TABLE "profiles" ALTER COLUMN "currency" SET DEFAULT 'ARS';--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "timezone" SET DEFAULT 'America/Argentina/Buenos_Aires';--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "default_view" SET DEFAULT 'dashboard';--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "weekly_start" SET DEFAULT 'monday';--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "number_format" SET DEFAULT 'es-AR';--> statement-breakpoint
UPDATE profiles
SET
  currency = CASE
    WHEN currency = 'Peso argentino (ARS)' THEN 'ARS'
    WHEN currency = 'Dólar estadounidense (USD)' THEN 'USD'
    WHEN currency = 'Euro (EUR)' THEN 'EUR'
    WHEN currency = 'Real brasileño (BRL)' THEN 'BRL'
    WHEN currency = 'Peso chileno (CLP)' THEN 'CLP'
    WHEN currency = 'Peso uruguayo (UYU)' THEN 'UYU'
    ELSE currency
  END,
  timezone = CASE
    WHEN timezone = '(GMT-03:00) Buenos Aires' THEN 'America/Argentina/Buenos_Aires'
    WHEN timezone = '(GMT-03:00) Montevideo' THEN 'America/Montevideo'
    WHEN timezone = '(GMT-04:00) Santiago' THEN 'America/Santiago'
    WHEN timezone = '(GMT-03:00) São Paulo' THEN 'America/Sao_Paulo'
    WHEN timezone = '(GMT-05:00) Nueva York' THEN 'America/New_York'
    WHEN timezone = '(GMT+00:00) Tiempo Universal Coordinado (UTC)' THEN 'UTC'
    ELSE timezone
  END,
  number_format = CASE
    WHEN number_format = '1.234,56' THEN 'es-AR'
    WHEN number_format = '1,234.56' THEN 'en-US'
    ELSE number_format
  END,
  weekly_start = CASE
    WHEN weekly_start = 'Lunes' THEN 'monday'
    WHEN weekly_start = 'Domingo' THEN 'sunday'
    ELSE weekly_start
  END,
  default_view = CASE
    WHEN default_view = 'Dashboard' THEN 'dashboard'
    WHEN default_view = 'Transacciones' THEN 'transactions'
    WHEN default_view = 'Suscripciones' THEN 'subscriptions'
    WHEN default_view = 'Cuentas' THEN 'accounts'
    ELSE default_view
  END ;