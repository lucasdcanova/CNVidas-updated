-- Create QR tokens table
CREATE TABLE IF NOT EXISTS "qr_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "used" BOOLEAN DEFAULT FALSE
);

-- Create index for better lookup performance
CREATE INDEX IF NOT EXISTS "idx_qr_tokens_token" ON "qr_tokens" ("token");
CREATE INDEX IF NOT EXISTS "idx_qr_tokens_user_id" ON "qr_tokens" ("user_id");