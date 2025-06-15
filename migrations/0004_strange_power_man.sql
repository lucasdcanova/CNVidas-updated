CREATE TABLE IF NOT EXISTS "medical_record_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"access_type" varchar(50) NOT NULL,
	"access_reason" text,
	"accessed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medical_record_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"appointment_id" integer,
	"author_id" integer NOT NULL,
	"entry_type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"subjective" text,
	"objective" text,
	"assessment" text,
	"plan" text,
	"vital_signs" json,
	"attachments" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"signed_at" timestamp,
	"signature" text,
	"ip_address" varchar(45),
	"cid10" varchar(10),
	"procedures" json,
	"prescriptions" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medical_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"record_number" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"chief_complaint" text,
	"history_of_present_illness" text,
	"past_medical_history" text,
	"medications" text,
	"allergies" text,
	"family_history" text,
	"social_history" text,
	"vital_signs" json,
	"physical_examination" text,
	"blood_type" varchar(5),
	"emergency_contact" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_accessed_at" timestamp,
	"last_accessed_by" integer,
	CONSTRAINT "medical_records_record_number_unique" UNIQUE("record_number")
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "profile_image" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_record_access" ADD CONSTRAINT "medical_record_access_record_id_medical_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "medical_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_record_access" ADD CONSTRAINT "medical_record_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_record_entries" ADD CONSTRAINT "medical_record_entries_record_id_medical_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "medical_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_record_entries" ADD CONSTRAINT "medical_record_entries_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_record_entries" ADD CONSTRAINT "medical_record_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_last_accessed_by_users_id_fk" FOREIGN KEY ("last_accessed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
