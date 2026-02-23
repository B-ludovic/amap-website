-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "renewalReminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "Subscription"("endDate");
