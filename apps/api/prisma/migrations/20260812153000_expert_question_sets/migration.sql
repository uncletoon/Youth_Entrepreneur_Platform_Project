CREATE TYPE "AssessmentDomainSource" AS ENUM (
  'SYSTEM_MANDATORY',
  'EXPERT_SUPPLEMENTAL',
  'LEGACY_ARCHIVED'
);

ALTER TABLE "AssessmentDomain"
ADD COLUMN "source" "AssessmentDomainSource" NOT NULL DEFAULT 'LEGACY_ARCHIVED',
ADD COLUMN "createdById" UUID,
ADD COLUMN "expertiseField" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AssessmentDomain" AS domain
SET "source" = 'SYSTEM_MANDATORY'
WHERE EXISTS (
  SELECT 1
  FROM "Question" AS question
  WHERE question."domainId" = domain."id"
    AND question."source" = 'SYSTEM_MANDATORY'
);

ALTER TABLE "AssessmentDomain"
ALTER COLUMN "source" SET DEFAULT 'SYSTEM_MANDATORY';

ALTER TABLE "AssessmentDomain"
ADD CONSTRAINT "AssessmentDomain_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AssessmentDomain_source_active_displayOrder_idx"
ON "AssessmentDomain"("source", "active", "displayOrder");

CREATE INDEX "AssessmentDomain_createdById_active_idx"
ON "AssessmentDomain"("createdById", "active");

CREATE TABLE "QuestionSector" (
  "questionId" UUID NOT NULL,
  "sectorId" UUID NOT NULL,
  CONSTRAINT "QuestionSector_pkey" PRIMARY KEY ("questionId", "sectorId")
);

ALTER TABLE "QuestionSector"
ADD CONSTRAINT "QuestionSector_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "Question"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionSector"
ADD CONSTRAINT "QuestionSector_sectorId_fkey"
FOREIGN KEY ("sectorId") REFERENCES "Sector"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "QuestionSector_sectorId_questionId_idx"
ON "QuestionSector"("sectorId", "questionId");

-- Preserve existing Expert questions by moving each creator/domain combination into an
-- owner-specific draft set. A set becomes available only when it contains 5-10 active questions.
INSERT INTO "AssessmentDomain" (
  "id", "code", "name", "description", "weight", "displayOrder", "active",
  "source", "createdById", "expertiseField", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'EXPERT_SET_' || UPPER(SUBSTRING(REPLACE(grouped."createdById"::text, '-', ''), 1, 8)) || '_' || domain."code",
  domain."name" || ' - Expert supplement',
  'Supplemental readiness questions created by an approved Expert.',
  1,
  1000 + ROW_NUMBER() OVER (ORDER BY grouped."createdById", grouped."domainId"),
  grouped."activeCount" BETWEEN 5 AND 10,
  'EXPERT_SUPPLEMENTAL',
  grouped."createdById",
  grouped."expertiseField",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    question."createdById",
    question."domainId",
    MAX(question."expertiseField") AS "expertiseField",
    COUNT(*) FILTER (WHERE question."active")::integer AS "activeCount"
  FROM "Question" AS question
  WHERE question."source" = 'EXPERT_SUPPLEMENTAL'
    AND question."createdById" IS NOT NULL
  GROUP BY question."createdById", question."domainId"
) AS grouped
JOIN "AssessmentDomain" AS domain ON domain."id" = grouped."domainId";

UPDATE "Question" AS question
SET "domainId" = expert_domain."id"
FROM "AssessmentDomain" AS old_domain,
     "AssessmentDomain" AS expert_domain
WHERE question."source" = 'EXPERT_SUPPLEMENTAL'
  AND question."createdById" IS NOT NULL
  AND old_domain."id" = question."domainId"
  AND expert_domain."code" =
    'EXPERT_SET_' || UPPER(SUBSTRING(REPLACE(question."createdById"::text, '-', ''), 1, 8)) || '_' || old_domain."code";

INSERT INTO "QuestionSector" ("questionId", "sectorId")
SELECT "id", "sectorId"
FROM "Question"
WHERE "source" = 'EXPERT_SUPPLEMENTAL'
  AND "sectorId" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "Question"
SET "sectorId" = NULL, "weight" = 1
WHERE "source" = 'EXPERT_SUPPLEMENTAL';
