-- CreateTable
CREATE TABLE "AmapClosure" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmapClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AmapClosure_startDate_idx" ON "AmapClosure"("startDate");
