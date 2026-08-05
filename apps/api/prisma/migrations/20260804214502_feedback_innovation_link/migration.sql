-- AlterTable
ALTER TABLE "AdminFeedback" ADD COLUMN     "businessId" UUID;

-- CreateIndex
CREATE INDEX "AdminFeedback_businessId_createdAt_idx" ON "AdminFeedback"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminFeedback" ADD CONSTRAINT "AdminFeedback_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
