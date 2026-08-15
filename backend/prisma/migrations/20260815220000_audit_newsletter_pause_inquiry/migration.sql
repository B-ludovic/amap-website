-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SEND_NEWSLETTER';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_NEWSLETTER';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_PRODUCER_INQUIRY';
ALTER TYPE "AuditAction" ADD VALUE 'PAUSE_SUBSCRIPTION';
ALTER TYPE "AuditAction" ADD VALUE 'RESUME_SUBSCRIPTION';
