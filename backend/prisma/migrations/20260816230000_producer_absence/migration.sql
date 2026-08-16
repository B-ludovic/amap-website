-- Absence ponctuelle d'une ferme, sans la retirer du partenariat.
--
-- Producer.isActive répond à « est-ce une ferme partenaire ? » et vaut pour
-- toujours ; AmapClosure suspend la distribution pour tout le monde. Aucun des
-- deux ne sait dire « cette semaine, cette ferme-là ne vient pas », ce qui
-- laissait ses produits entrer dans le tirage du panier.

-- CreateTable
CREATE TABLE "ProducerAbsence" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProducerAbsence_producerId_idx" ON "ProducerAbsence"("producerId");

-- CreateIndex
CREATE INDEX "ProducerAbsence_startDate_endDate_idx" ON "ProducerAbsence"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "ProducerAbsence" ADD CONSTRAINT "ProducerAbsence_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
