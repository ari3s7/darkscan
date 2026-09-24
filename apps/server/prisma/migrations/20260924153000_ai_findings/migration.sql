-- AlterTable
ALTER TABLE "Scan" ADD COLUMN "aiStatus" TEXT;

-- AlterTable
ALTER TABLE "Finding" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'rule';
