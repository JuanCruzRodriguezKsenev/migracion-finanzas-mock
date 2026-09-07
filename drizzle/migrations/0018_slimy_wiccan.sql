ALTER TABLE "subscriptions" ALTER COLUMN "amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "balance" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "debit" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "credit" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "monthly_summaries" ALTER COLUMN "total_revenue" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "monthly_summaries" ALTER COLUMN "total_expense" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "monthly_summaries" ALTER COLUMN "balance_snapshot" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "monthly_summaries" ALTER COLUMN "assets_snapshot" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "monthly_summaries" ALTER COLUMN "liabilities_snapshot" SET DATA TYPE bigint;