/*
  Warnings:

  - You are about to drop the `addresses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `basket_availabilities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `basket_type_products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `basket_types` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `blog_posts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cart_reservations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_emails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pickup_locations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `producers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `theme_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'VOLUNTEER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('KG', 'PIECE');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('VEGETABLES', 'FRUITS', 'EGGS', 'GROCERY');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('ANNUAL', 'DISCOVERY');

-- CreateEnum
CREATE TYPE "BasketSize" AS ENUM ('SMALL', 'LARGE');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('NORMAL', 'SOLIDARITY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'ABSENT');

-- CreateEnum
CREATE TYPE "NewsletterType" AS ENUM ('GENERAL', 'WEEKLY_BASKET', 'RECIPE', 'ALERT', 'PRODUCER_NEWS');

-- CreateEnum
CREATE TYPE "NewsletterTarget" AS ENUM ('ALL', 'ACTIVE_SUBSCRIBERS', 'SOLIDARITY', 'TEST');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'ACCEPTED', 'REJECTED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_userId_fkey";

-- DropForeignKey
ALTER TABLE "basket_availabilities" DROP CONSTRAINT "basket_availabilities_basketTypeId_fkey";

-- DropForeignKey
ALTER TABLE "basket_availabilities" DROP CONSTRAINT "basket_availabilities_pickupLocationId_fkey";

-- DropForeignKey
ALTER TABLE "basket_type_products" DROP CONSTRAINT "basket_type_products_basketTypeId_fkey";

-- DropForeignKey
ALTER TABLE "basket_type_products" DROP CONSTRAINT "basket_type_products_productId_fkey";

-- DropForeignKey
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_authorId_fkey";

-- DropForeignKey
ALTER TABLE "cart_reservations" DROP CONSTRAINT "cart_reservations_basketAvailabilityId_fkey";

-- DropForeignKey
ALTER TABLE "cart_reservations" DROP CONSTRAINT "cart_reservations_userId_fkey";

-- DropForeignKey
ALTER TABLE "notification_emails" DROP CONSTRAINT "notification_emails_userId_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_basketAvailabilityId_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_orderId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_pickupLocationId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_orderId_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_producerId_fkey";

-- DropTable
DROP TABLE "addresses";

-- DropTable
DROP TABLE "basket_availabilities";

-- DropTable
DROP TABLE "basket_type_products";

-- DropTable
DROP TABLE "basket_types";

-- DropTable
DROP TABLE "blog_posts";

-- DropTable
DROP TABLE "cart_reservations";

-- DropTable
DROP TABLE "notification_emails";

-- DropTable
DROP TABLE "order_items";

-- DropTable
DROP TABLE "orders";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "pickup_locations";

-- DropTable
DROP TABLE "producers";

-- DropTable
DROP TABLE "products";

-- DropTable
DROP TABLE "theme_configs";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "AddressType";

-- DropEnum
DROP TYPE "EmailStatus";

-- DropEnum
DROP TYPE "NotificationEmailType";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "description" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "unit" "ProductUnit" NOT NULL,
    "category" "ProductCategory",
    "description" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT 'Mercredi 18h15 - 19h15',
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionNumber" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "basketSize" "BasketSize" NOT NULL,
    "pricingType" "PricingType" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pickupLocationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPause" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentId" TEXT,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyBasket" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "distributionDate" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyBasket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyBasketItem" (
    "id" TEXT NOT NULL,
    "weeklyBasketId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantitySmall" DOUBLE PRECISION NOT NULL,
    "quantityLarge" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WeeklyBasketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPickup" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "weeklyBasketId" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "wasPickedUp" BOOLEAN NOT NULL DEFAULT false,
    "pickedUpAt" TIMESTAMP(3),
    "pickedUpBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "distributionDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '18:15',
    "endTime" TEXT NOT NULL DEFAULT '19:15',
    "volunteersNeeded" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftVolunteer" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "status" "VolunteerStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "NewsletterType" NOT NULL DEFAULT 'GENERAL',
    "target" "NewsletterTarget" NOT NULL DEFAULT 'ALL',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "ingredients" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "prepTime" INTEGER,
    "cookTime" INTEGER,
    "servings" INTEGER,
    "difficulty" "RecipeDifficulty" DEFAULT 'EASY',
    "season" "Season",
    "image" TEXT,
    "tips" TEXT,
    "authorId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeProduct" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecipeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducerInquiry" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "farmName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "distance" INTEGER,
    "products" TEXT NOT NULL,
    "isBio" BOOLEAN NOT NULL DEFAULT false,
    "certifications" TEXT,
    "message" TEXT,
    "availability" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeConfig" (
    "id" TEXT NOT NULL,
    "season" "Season" NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "backgroundImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_email_key" ON "Producer"("email");

-- CreateIndex
CREATE INDEX "Producer_email_idx" ON "Producer"("email");

-- CreateIndex
CREATE INDEX "Producer_isActive_idx" ON "Producer"("isActive");

-- CreateIndex
CREATE INDEX "Product_producerId_idx" ON "Product"("producerId");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriptionNumber_key" ON "Subscription"("subscriptionNumber");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_type_idx" ON "Subscription"("type");

-- CreateIndex
CREATE INDEX "Subscription_pricingType_idx" ON "Subscription"("pricingType");

-- CreateIndex
CREATE INDEX "SubscriptionPause_subscriptionId_idx" ON "SubscriptionPause"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentId_key" ON "Payment"("stripePaymentId");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "WeeklyBasket_distributionDate_idx" ON "WeeklyBasket"("distributionDate");

-- CreateIndex
CREATE INDEX "WeeklyBasket_isPublished_idx" ON "WeeklyBasket"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyBasket_year_weekNumber_key" ON "WeeklyBasket"("year", "weekNumber");

-- CreateIndex
CREATE INDEX "WeeklyBasketItem_productId_idx" ON "WeeklyBasketItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyBasketItem_weeklyBasketId_productId_key" ON "WeeklyBasketItem"("weeklyBasketId", "productId");

-- CreateIndex
CREATE INDEX "WeeklyPickup_weeklyBasketId_idx" ON "WeeklyPickup"("weeklyBasketId");

-- CreateIndex
CREATE INDEX "WeeklyPickup_pickupDate_idx" ON "WeeklyPickup"("pickupDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPickup_subscriptionId_weeklyBasketId_key" ON "WeeklyPickup"("subscriptionId", "weeklyBasketId");

-- CreateIndex
CREATE INDEX "Shift_distributionDate_idx" ON "Shift"("distributionDate");

-- CreateIndex
CREATE INDEX "ShiftVolunteer_userId_idx" ON "ShiftVolunteer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftVolunteer_shiftId_userId_key" ON "ShiftVolunteer"("shiftId", "userId");

-- CreateIndex
CREATE INDEX "Newsletter_sentAt_idx" ON "Newsletter"("sentAt");

-- CreateIndex
CREATE INDEX "Newsletter_createdBy_idx" ON "Newsletter"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_slug_idx" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_season_idx" ON "Recipe"("season");

-- CreateIndex
CREATE INDEX "Recipe_isPublished_idx" ON "Recipe"("isPublished");

-- CreateIndex
CREATE INDEX "RecipeProduct_recipeId_idx" ON "RecipeProduct"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeProduct_productId_idx" ON "RecipeProduct"("productId");

-- CreateIndex
CREATE INDEX "ProducerInquiry_status_idx" ON "ProducerInquiry"("status");

-- CreateIndex
CREATE INDEX "ProducerInquiry_createdAt_idx" ON "ProducerInquiry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeConfig_season_key" ON "ThemeConfig"("season");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "PickupLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPause" ADD CONSTRAINT "SubscriptionPause_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyBasketItem" ADD CONSTRAINT "WeeklyBasketItem_weeklyBasketId_fkey" FOREIGN KEY ("weeklyBasketId") REFERENCES "WeeklyBasket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyBasketItem" ADD CONSTRAINT "WeeklyBasketItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPickup" ADD CONSTRAINT "WeeklyPickup_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPickup" ADD CONSTRAINT "WeeklyPickup_weeklyBasketId_fkey" FOREIGN KEY ("weeklyBasketId") REFERENCES "WeeklyBasket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftVolunteer" ADD CONSTRAINT "ShiftVolunteer_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftVolunteer" ADD CONSTRAINT "ShiftVolunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Newsletter" ADD CONSTRAINT "Newsletter_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeProduct" ADD CONSTRAINT "RecipeProduct_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeProduct" ADD CONSTRAINT "RecipeProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
