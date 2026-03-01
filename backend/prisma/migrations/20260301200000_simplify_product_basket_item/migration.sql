-- AlterTable Product: remove unit and stock columns
ALTER TABLE "Product" DROP COLUMN IF EXISTS "unit";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "stock";

-- Drop ProductUnit enum
DROP TYPE IF EXISTS "ProductUnit";

-- AlterTable WeeklyBasketItem: remove quantitySmall, quantityLarge, make productId nullable, add customProductName
ALTER TABLE "WeeklyBasketItem" DROP COLUMN IF EXISTS "quantitySmall";
ALTER TABLE "WeeklyBasketItem" DROP COLUMN IF EXISTS "quantityLarge";
ALTER TABLE "WeeklyBasketItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "WeeklyBasketItem" ADD COLUMN IF NOT EXISTS "customProductName" TEXT;

-- Drop unique constraint on (weeklyBasketId, productId)
ALTER TABLE "WeeklyBasketItem" DROP CONSTRAINT IF EXISTS "WeeklyBasketItem_weeklyBasketId_productId_key";

-- Update foreign key to SetNull on delete (drop and re-add)
ALTER TABLE "WeeklyBasketItem" DROP CONSTRAINT IF EXISTS "WeeklyBasketItem_productId_fkey";
ALTER TABLE "WeeklyBasketItem" ADD CONSTRAINT "WeeklyBasketItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index on weeklyBasketId if not exists
CREATE INDEX IF NOT EXISTS "WeeklyBasketItem_weeklyBasketId_idx" ON "WeeklyBasketItem"("weeklyBasketId");
