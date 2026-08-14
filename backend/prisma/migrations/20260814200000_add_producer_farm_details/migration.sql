-- Fiche de la ferme : localisation, certification, détail d'exploitation et
-- année d'entrée dans l'AMAP, affichés sur la page publique des producteurs.

-- CreateEnum
CREATE TYPE "ProducerCertification" AS ENUM ('NONE', 'ORGANIC', 'CONVERSION');

-- AlterTable
ALTER TABLE "Producer"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "distanceKm" INTEGER,
  ADD COLUMN "certification" "ProducerCertification" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "farmDetailLabel" TEXT,
  ADD COLUMN "farmDetail" TEXT,
  ADD COLUMN "partnerSince" INTEGER;
