ALTER TABLE "ledger_transactions" ADD COLUMN "occurred_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "ledger_transactions" SET "occurred_at" = "created_at";--> statement-breakpoint
CREATE INDEX "ledger_tx_org_occurred_idx" ON "ledger_transactions" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "ledger_tx_org_occurred_id_idx" ON "ledger_transactions" USING btree ("organization_id","occurred_at","id");