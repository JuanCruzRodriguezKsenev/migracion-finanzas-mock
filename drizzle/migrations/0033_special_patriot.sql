CREATE TABLE "goal_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" varchar(12) NOT NULL,
	"amount" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_movements_amount_positive" CHECK ("goal_movements"."amount" > 0),
	CONSTRAINT "goal_movements_kind_valid" CHECK ("goal_movements"."kind" IN ('contribution','withdrawal'))
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"target_amount" bigint NOT NULL,
	"target_date" date,
	"priority" varchar(10) DEFAULT 'normal' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_target_amount_positive" CHECK ("goals"."target_amount" > 0),
	CONSTRAINT "goals_priority_valid" CHECK ("goals"."priority" IN ('normal','high')),
	CONSTRAINT "goals_status_valid" CHECK ("goals"."status" IN ('active','completed','abandoned'))
);
--> statement-breakpoint
ALTER TABLE "goal_movements" ADD CONSTRAINT "goal_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_movements" ADD CONSTRAINT "goal_movements_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_movements" ADD CONSTRAINT "goal_movements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_movements_goal_idx" ON "goal_movements" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goal_movements_account_idx" ON "goal_movements" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "goals_org_status_idx" ON "goals" USING btree ("organization_id","status");