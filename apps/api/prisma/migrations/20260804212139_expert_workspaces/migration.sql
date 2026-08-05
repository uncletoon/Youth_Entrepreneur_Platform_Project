-- CreateEnum
CREATE TYPE "ExpertApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExpertProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expertiseField" TEXT NOT NULL,
    "proficiencyLevel" TEXT NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL,
    "employmentStatus" TEXT NOT NULL,
    "workplace" TEXT,
    "position" TEXT,
    "highestQualification" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "certifications" TEXT,
    "professionalSummary" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "approvalStatus" "ExpertApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpertProfile_userId_key" ON "ExpertProfile"("userId");

-- CreateIndex
CREATE INDEX "ExpertProfile_approvalStatus_submittedAt_idx" ON "ExpertProfile"("approvalStatus", "submittedAt");

-- AddForeignKey
ALTER TABLE "ExpertProfile" ADD CONSTRAINT "ExpertProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertProfile" ADD CONSTRAINT "ExpertProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
