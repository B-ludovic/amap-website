-- AlterTable
ALTER TABLE "WeeklyBasket" ADD COLUMN     "notifiedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notifyFailedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notifyingSince" TIMESTAMP(3);

-- Les paniers déjà publiés gardent 0 : le compte n'a jamais été écrit nulle
-- part. Ils ne seront pas repris pour autant — la reprise ne regarde que les
-- paniers dont la distribution est encore à venir, et ceux-là sont tous passés.

-- La reprise interroge les paniers publiés dont la distribution n'a pas eu lieu,
-- toutes les heures et à chaque démarrage. Sans cet index elle balaie la table
-- entière pour n'en retenir, la plupart du temps, aucun.
CREATE INDEX "WeeklyBasket_isPublished_distributionDate_idx" ON "WeeklyBasket"("isPublished", "distributionDate");
