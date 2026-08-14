-- Add the seasonal product catalogue and preserve eligible basket sizes in weekly snapshots.
ALTER TABLE "Product"
  ADD COLUMN "seasons" "Season"[] NOT NULL DEFAULT ARRAY[]::"Season"[],
  ADD COLUMN "basketSizes" "BasketSize"[] NOT NULL DEFAULT ARRAY['SMALL', 'LARGE']::"BasketSize"[];

ALTER TABLE "WeeklyBasket"
  ADD COLUMN "season" "Season";

ALTER TABLE "WeeklyBasketItem"
  ADD COLUMN "basketSizes" "BasketSize"[] NOT NULL DEFAULT ARRAY['SMALL', 'LARGE']::"BasketSize"[];