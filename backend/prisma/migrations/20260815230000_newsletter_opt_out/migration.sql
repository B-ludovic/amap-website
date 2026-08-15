-- AlterTable
ALTER TABLE "User" ADD COLUMN     "newsletterOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "newsletterOptOutAt" TIMESTAMP(3);
