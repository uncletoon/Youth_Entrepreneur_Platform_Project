UPDATE "User"
SET "status" = 'ACTIVE'
WHERE "status" = 'PENDING_VERIFICATION';

DROP TABLE IF EXISTS "VerificationToken";

ALTER TABLE "User" DROP COLUMN IF EXISTS "contactVerifiedAt";

ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "status" TYPE "UserStatus"
  USING ("status"::text::"UserStatus");
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "UserStatus_old";
