CREATE TABLE "account_shares" (
	"account_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_shares_account_id_organization_id_pk" PRIMARY KEY("account_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_shares_organization_id_idx" ON "account_shares" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_asset_check" CHECK ("accounts"."owner_user_id" IS NULL OR "accounts"."type" = 'asset');--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_pot_check" CHECK (NOT ("accounts"."owner_user_id" IS NOT NULL AND "accounts"."is_common_pot"));