CREATE TYPE "QuestionSource" AS ENUM ('SYSTEM_MANDATORY', 'EXPERT_SUPPLEMENTAL', 'LEGACY_ARCHIVED');

ALTER TABLE "AssessmentDomain"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Question"
ADD COLUMN "source" "QuestionSource" NOT NULL DEFAULT 'LEGACY_ARCHIVED',
ADD COLUMN "createdById" UUID,
ADD COLUMN "expertiseField" TEXT;

ALTER TABLE "Question"
ALTER COLUMN "source" SET DEFAULT 'SYSTEM_MANDATORY';

ALTER TABLE "AssessmentResult"
ADD COLUMN "supplementalScores" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Question"
ADD CONSTRAINT "Question_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Question_source_active_displayOrder_idx"
ON "Question"("source", "active", "displayOrder");

CREATE INDEX "Question_createdById_active_idx"
ON "Question"("createdById", "active");

-- Open sessions created against the previous questionnaire remain available as history, but
-- entrepreneurs restart them against the new mandatory 50-question framework.
UPDATE "AssessmentSession"
SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('DRAFT', 'IN_PROGRESS');
