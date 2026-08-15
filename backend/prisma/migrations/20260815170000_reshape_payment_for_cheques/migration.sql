-- Correction d'une dérive antérieure.
--
-- La migration 20260301200000 voulait retirer l'unicité de (weeklyBasketId,
-- productId) et écrivait « ALTER TABLE ... DROP CONSTRAINT IF EXISTS ». Or
-- Prisma matérialise un @@unique par un index unique, pas par une contrainte de
-- table : l'instruction ne trouvait rien et ne faisait rien. La vraie base a
-- bien perdu son index — quatre couples (panier, produit) en double y vivent,
-- l'unicité ne pourrait plus y être rétablie — mais l'historique rejoué le
-- croyait toujours présent, et « prisma migrate dev » proposait donc de
-- réinitialiser la base à chaque migration suivante.
--
-- DROP INDEX agit là où DROP CONSTRAINT était sans effet. L'instruction est sans
-- objet sur la base réelle, et remet l'historique d'aplomb.
DROP INDEX IF EXISTS "WeeklyBasketItem_weeklyBasketId_productId_key";

-- Payment : remodelé pour le chèque papier.
--
-- Le cycle de vie décrit un lieu — la pochette du trésorier, la banque, le
-- compte — et non un état abstrait. Il commence à RECEIVED parce qu'une ligne
-- n'existe qu'à partir du moment où le chèque est en main.

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('RECEIVED', 'DEPOSITED', 'SUCCEEDED', 'FAILED', 'RETURNED');
ALTER TABLE "public"."Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';
COMMIT;

-- DropIndex
DROP INDEX "Payment_stripePaymentId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "paymentMethod",
DROP COLUMN "stripePaymentId",
ADD COLUMN     "checkNumber" TEXT,
ADD COLUMN     "depositedAt" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- CreateIndex
CREATE INDEX "Payment_dueDate_idx" ON "Payment"("dueDate");
