-- AlterTable
ALTER TABLE "SubscriptionRequest" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "SubscriptionRequest_userId_idx" ON "SubscriptionRequest"("userId");

-- AddForeignKey
ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
