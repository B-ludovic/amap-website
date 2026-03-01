-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DELETE_USER', 'CHANGE_USER_ROLE', 'CREATE_PRODUCER', 'DELETE_PRODUCER', 'CREATE_PRODUCT', 'DELETE_PRODUCT', 'DELETE_CONTACT_MESSAGE', 'DELETE_EXAMPLES', 'APPROVE_SUBSCRIPTION_REQUEST', 'REJECT_SUBSCRIPTION_REQUEST', 'CANCEL_SUBSCRIPTION', 'UPDATE_SUBSCRIPTION_STATUS');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('CRITICAL', 'IMPORTANT');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "adminEmail" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "severity" "AuditSeverity" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
