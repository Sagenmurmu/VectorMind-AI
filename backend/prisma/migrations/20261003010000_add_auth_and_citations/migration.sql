-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "citations" JSONB DEFAULT '[]';
