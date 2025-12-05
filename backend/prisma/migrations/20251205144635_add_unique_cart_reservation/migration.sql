/*
  Warnings:

  - A unique constraint covering the columns `[userId,basketAvailabilityId]` on the table `cart_reservations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "cart_reservations_userId_basketAvailabilityId_key" ON "cart_reservations"("userId", "basketAvailabilityId");
