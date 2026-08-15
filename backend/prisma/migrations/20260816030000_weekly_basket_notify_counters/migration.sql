-- AlterTable
ALTER TABLE "WeeklyBasket" ADD COLUMN     "notifiedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notifyFailedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notifyingSince" TIMESTAMP(3);

-- Les paniers déjà publiés gardent 0 : le compte n'a jamais été écrit nulle
-- part, il n'existe nulle part d'où le tirer.
--
-- Ils gardent surtout notifyingSince à NULL, et c'est ce qui les met hors de
-- portée de la reprise. Celle-ci ne rattrape que les boucles qu'elle a vues
-- commencer ; un panier publié avant ce mécanisme n'a pas de trace d'envoi dans
-- EmailLog, et serait sinon renotifié en entier au premier démarrage.

-- La reprise interroge les paniers publiés dont la distribution n'a pas eu lieu.
-- L'index sert aussi les écrans qui listent les paniers publiés par date.
CREATE INDEX "WeeklyBasket_isPublished_distributionDate_idx" ON "WeeklyBasket"("isPublished", "distributionDate");
