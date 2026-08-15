-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Newsletter" ADD COLUMN     "status" "NewsletterStatus" NOT NULL DEFAULT 'DRAFT';

-- Rattrapage de l'existant.
--
-- Sans cette ligne, toutes les newsletters déjà parties repasseraient en
-- brouillon : la prise du drapeau accepte DRAFT, elles redeviendraient donc
-- renvoyables, et un clic malheureux dans l'écran de communication réexpédierait
-- une lettre vieille de six mois à tous les adhérents. Le seul témoin fiable de
-- l'existant est sentAt, puisque c'est lui qui verrouillait jusqu'ici.
UPDATE "Newsletter" SET "status" = 'SENT' WHERE "sentAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Newsletter_status_idx" ON "Newsletter"("status");
