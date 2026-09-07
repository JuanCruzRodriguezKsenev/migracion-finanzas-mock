ALTER TABLE "financial_entities" ADD COLUMN "brand_domain" varchar(100);--> statement-breakpoint
UPDATE financial_entities
SET brand_domain = logo , logo = 'bank'
WHERE logo LIKE '%.%' ;