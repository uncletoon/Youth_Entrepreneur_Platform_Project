-- Remove stale open sessions that were created before a sibling assessment was submitted.
DELETE FROM "AssessmentSession" AS open_session
WHERE open_session."status" IN ('DRAFT', 'IN_PROGRESS')
  AND EXISTS (
    SELECT 1
    FROM "AssessmentSession" AS submitted_session
    WHERE submitted_session."userId" = open_session."userId"
      AND submitted_session."businessId" = open_session."businessId"
      AND submitted_session."submittedAt" IS NOT NULL
      AND open_session."createdAt" <= submitted_session."submittedAt"
  );

-- If an older deployment produced multiple still-open sessions, retain the one with the
-- most saved answers and then the most recently updated session.
WITH ranked_open_sessions AS (
  SELECT
    session.id,
    ROW_NUMBER() OVER (
      PARTITION BY session."userId", session."businessId"
      ORDER BY
        (SELECT COUNT(*) FROM "AssessmentResponse" response WHERE response."sessionId" = session.id) DESC,
        session."updatedAt" DESC,
        session."createdAt" DESC,
        session.id DESC
    ) AS position
  FROM "AssessmentSession" AS session
  WHERE session."status" IN ('DRAFT', 'IN_PROGRESS')
)
DELETE FROM "AssessmentSession"
WHERE id IN (
  SELECT id
  FROM ranked_open_sessions
  WHERE position > 1
);

CREATE UNIQUE INDEX "AssessmentSession_one_open_per_business_key"
ON "AssessmentSession" ("userId", "businessId")
WHERE "status" IN ('DRAFT', 'IN_PROGRESS');
