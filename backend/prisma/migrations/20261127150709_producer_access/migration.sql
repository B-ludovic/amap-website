-- CreateEnum
CREATE TYPE "ProducerAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_PRODUCER_ACCESS_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'FAILED_PRODUCER_ACCESS_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE_PRODUCER_ACCESS_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'FAILED_PRODUCER_ACCESS_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE 'REJECT_PRODUCER_ACCESS_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'FAILED_PRODUCER_ACCESS_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE 'REVOKE_PRODUCER_ACCESS';
ALTER TYPE "AuditAction" ADD VALUE 'FAILED_PRODUCER_ACCESS_REVOCATION';
ALTER TYPE "AuditAction" ADD VALUE 'FAILED_PRODUCER_APPROVAL_EMAIL';
ALTER TYPE "AuditAction" ADD VALUE 'FAILED_PRODUCER_REJECTION_EMAIL';
ALTER TYPE "AuditAction" ADD VALUE 'FAILED_PRODUCER_SCOPE_CHECK';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_PRODUCT_DELETION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailKind" ADD VALUE 'PRODUCER_ACCESS_APPROVED';
ALTER TYPE "EmailKind" ADD VALUE 'PRODUCER_ACCESS_REJECTED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PRODUCER';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "producerId" TEXT;

-- CreateTable
CREATE TABLE "ProducerAccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmClaim" TEXT NOT NULL,
    "status" "ProducerAccessStatus" NOT NULL DEFAULT 'PENDING',
    "previousRole" "UserRole",
    "adminNotes" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProducerAccessRequest_userId_idx" ON "ProducerAccessRequest"("userId");

-- CreateIndex
CREATE INDEX "ProducerAccessRequest_status_idx" ON "ProducerAccessRequest"("status");

-- CreateIndex
CREATE INDEX "ProducerAccessRequest_createdAt_idx" ON "ProducerAccessRequest"("createdAt");

-- CreateIndex
CREATE INDEX "User_producerId_idx" ON "User"("producerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducerAccessRequest" ADD CONSTRAINT "ProducerAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
