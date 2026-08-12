-- Reconcile the previously applied Recommendation.businessId hotfix with migration history.
ALTER TABLE "Recommendation" ADD COLUMN IF NOT EXISTS "businessId" UUID;
CREATE INDEX IF NOT EXISTS "Recommendation_businessId_createdAt_idx"
  ON "Recommendation"("businessId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Recommendation_businessId_fkey'
  ) THEN
    ALTER TABLE "Recommendation"
      ADD CONSTRAINT "Recommendation_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Separate approved experts from administrative accounts.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EXPERT';

-- Preserve businesses while allowing entrepreneurs to archive them.
ALTER TABLE "Business" ADD COLUMN "archivedAt" TIMESTAMP(3);
DROP INDEX IF EXISTS "Business_userId_stage_idx";
CREATE INDEX "Business_userId_stage_archivedAt_idx"
  ON "Business"("userId", "stage", "archivedAt");

-- Explicit System Administrator-managed Expert assignments.
CREATE TABLE "ExpertAssignment" (
  "id" UUID NOT NULL,
  "expertId" UUID NOT NULL,
  "entrepreneurId" UUID NOT NULL,
  "assignedById" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpertAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExpertAssignment_expertId_entrepreneurId_key"
  ON "ExpertAssignment"("expertId", "entrepreneurId");
CREATE INDEX "ExpertAssignment_expertId_active_idx"
  ON "ExpertAssignment"("expertId", "active");
CREATE INDEX "ExpertAssignment_entrepreneurId_active_idx"
  ON "ExpertAssignment"("entrepreneurId", "active");
ALTER TABLE "ExpertAssignment"
  ADD CONSTRAINT "ExpertAssignment_expertId_fkey"
  FOREIGN KEY ("expertId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpertAssignment"
  ADD CONSTRAINT "ExpertAssignment_entrepreneurId_fkey"
  FOREIGN KEY ("entrepreneurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpertAssignment"
  ADD CONSTRAINT "ExpertAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Threaded replies to Expert feedback.
CREATE TABLE "FeedbackReply" (
  "id" UUID NOT NULL,
  "feedbackId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeedbackReply_feedbackId_createdAt_idx"
  ON "FeedbackReply"("feedbackId", "createdAt");
CREATE INDEX "FeedbackReply_authorId_createdAt_idx"
  ON "FeedbackReply"("authorId", "createdAt");
ALTER TABLE "FeedbackReply"
  ADD CONSTRAINT "FeedbackReply_feedbackId_fkey"
  FOREIGN KEY ("feedbackId") REFERENCES "AdminFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackReply"
  ADD CONSTRAINT "FeedbackReply_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Durable in-app notifications, with optional external delivery handled by the API.
CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
