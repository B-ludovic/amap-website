-- AlterTable
ALTER TABLE "basket_types" ADD COLUMN     "isExample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pickup_locations" ADD COLUMN     "isExample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "producers" ADD COLUMN     "isExample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isExample" BOOLEAN NOT NULL DEFAULT false;
