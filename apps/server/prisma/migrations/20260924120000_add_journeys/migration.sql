-- AlterTable
ALTER TABLE "Finding" ADD COLUMN "journeyStepId" TEXT;

-- CreateTable
CREATE TABLE "Journey" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyStep" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "pageId" TEXT,
    "position" INTEGER NOT NULL,
    "pageKind" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionSelector" TEXT,
    "actionType" TEXT,

    CONSTRAINT "JourneyStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Finding_journeyStepId_idx" ON "Finding"("journeyStepId");

-- CreateIndex
CREATE INDEX "Journey_scanId_idx" ON "Journey"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "Journey_scanId_type_key" ON "Journey"("scanId", "type");

-- CreateIndex
CREATE INDEX "JourneyStep_journeyId_idx" ON "JourneyStep"("journeyId");

-- CreateIndex
CREATE INDEX "JourneyStep_pageId_idx" ON "JourneyStep"("pageId");

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_journeyStepId_fkey" FOREIGN KEY ("journeyStepId") REFERENCES "JourneyStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStep" ADD CONSTRAINT "JourneyStep_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStep" ADD CONSTRAINT "JourneyStep_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
