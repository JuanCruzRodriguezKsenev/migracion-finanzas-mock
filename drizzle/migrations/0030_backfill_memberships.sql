INSERT INTO "memberships" ("user_id","organization_id","role")
SELECT "id","organization_id", CASE WHEN "role" = 'owner' THEN 'owner' ELSE 'member' END FROM "users"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "users" SET "last_organization_id" = "organization_id";