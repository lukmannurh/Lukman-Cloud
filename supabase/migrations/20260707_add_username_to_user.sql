-- Add username columns required by Better Auth username plugin
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" TEXT UNIQUE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "displayUsername" TEXT;

-- Index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_user_username ON "user"("username");
