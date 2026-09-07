DROP INDEX "ledger_tx_org_occurred_idx";--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "reverses_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "reversed_at" timestamp with time zone;