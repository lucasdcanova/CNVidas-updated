ALTER TABLE "partner_services" ADD COLUMN "is_national" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "nationwide_service" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_acceptances" DROP COLUMN IF EXISTS "is_active";