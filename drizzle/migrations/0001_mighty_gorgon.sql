CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"phone" varchar(50),
	"currency" varchar(100) DEFAULT 'Peso mexicano (MXN)' NOT NULL,
	"timezone" varchar(100) DEFAULT '(GMT-06:00) Ciudad de México' NOT NULL,
	"bio" text,
	"theme" varchar(50) DEFAULT 'Sistema' NOT NULL,
	"default_view" varchar(100) DEFAULT 'Dashboard' NOT NULL,
	"fast_login" boolean DEFAULT true NOT NULL,
	"weekly_start" varchar(50) DEFAULT 'Lunes' NOT NULL,
	"date_format" varchar(50) DEFAULT 'DD/MM/YYYY' NOT NULL,
	"number_format" varchar(50) DEFAULT '1,234.56' NOT NULL,
	"round_amounts" boolean DEFAULT false NOT NULL,
	"include_transfers" boolean DEFAULT true NOT NULL,
	"default_account" varchar(100),
	"plan_name" varchar(50) DEFAULT 'Básico' NOT NULL,
	"plan_billing" varchar(50) DEFAULT 'Mensual' NOT NULL,
	"plan_next_charge" varchar(100) DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;