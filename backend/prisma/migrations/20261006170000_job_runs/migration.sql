-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "JobRun" (
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "status" "JobRunStatus",
    "error" TEXT,
    "version" TEXT,
    "versionSince" TIMESTAMP(3),

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("name")
);
