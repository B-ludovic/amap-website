-- CreateEnum
CREATE TYPE "EmailDelivery" AS ENUM ('DELIVERED', 'DEFERRED', 'SOFT_BOUNCE', 'HARD_BOUNCE', 'BLOCKED', 'SPAM_COMPLAINT');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('HARD_BOUNCE', 'BLOCKED', 'MANUAL');

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "delivery" "EmailDelivery",
ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");

-- CreateIndex
CREATE INDEX "EmailSuppression_reason_idx" ON "EmailSuppression"("reason");

-- CreateIndex
CREATE INDEX "EmailSuppression_lastEventAt_idx" ON "EmailSuppression"("lastEventAt");

-- CreateIndex
CREATE INDEX "EmailLog_messageId_idx" ON "EmailLog"("messageId");

-- CreateIndex
CREATE INDEX "EmailLog_delivery_idx" ON "EmailLog"("delivery");
