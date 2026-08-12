-- Existing legacy ADMIN accounts were converted to EXPERT in the preceding migration.
-- Rebuild the enum so future writes cannot reintroduce the ambiguous role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole_old') THEN
    ALTER TYPE "UserRole" RENAME TO "UserRole_old";
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'EXPERT', 'ENTREPRENEUR');
  END IF;
END
$$;
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING ("role"::text::"UserRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ENTREPRENEUR'::"UserRole";
DROP TYPE "UserRole_old";
