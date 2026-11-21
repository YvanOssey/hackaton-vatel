-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CONSUMER', 'CASHIER', 'CHEF', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TariffGroup" AS ENUM ('STUDENT', 'SCHOLARSHIP', 'STAFF', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "Course" AS ENUM ('STARTER', 'MAIN', 'DESSERT');

-- CreateEnum
CREATE TYPE "MenuStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "NutriScore" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'CANCELLED', 'SERVED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('TOPUP', 'MEAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'WALLET', 'ADMIN');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONSUMER',
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "tariffGroup" "TariffGroup" NOT NULL DEFAULT 'EXTERNAL',
    "requestedGroup" "TariffGroup",
    "memberRef" TEXT,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "balance" INTEGER NOT NULL DEFAULT 0,
    "passVersion" INTEGER NOT NULL DEFAULT 1,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "MenuStatus" NOT NULL DEFAULT 'DRAFT',
    "nutriScore" "NutriScore" NOT NULL DEFAULT 'B',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "course" "Course" NOT NULL,
    "name" TEXT NOT NULL,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kcal" INTEGER NOT NULL DEFAULT 0,
    "vegetarian" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "price" INTEGER NOT NULL,
    "walkIn" BOOLEAN NOT NULL DEFAULT false,
    "allergenOverride" BOOLEAN NOT NULL DEFAULT false,
    "servedAt" TIMESTAMP(3),
    "servedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "reservationId" TEXT,
    "cashSessionId" TEXT,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingFloat" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "expectedCash" INTEGER,
    "countedCash" INTEGER,
    "difference" INTEGER,
    "closingNote" TEXT,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "establishmentName" TEXT NOT NULL DEFAULT 'Restaurant collectif',
    "cutoffTime" TEXT NOT NULL DEFAULT '10:00',
    "bookingHorizonDays" INTEGER NOT NULL DEFAULT 14,
    "lowBalanceThreshold" INTEGER NOT NULL DEFAULT 2000,
    "allowWalkIn" BOOLEAN NOT NULL DEFAULT true,
    "priceStudent" INTEGER NOT NULL DEFAULT 1500,
    "priceScholarship" INTEGER NOT NULL DEFAULT 500,
    "priceStaff" INTEGER NOT NULL DEFAULT 2500,
    "priceExternal" INTEGER NOT NULL DEFAULT 4000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "minQty" INTEGER NOT NULL DEFAULT 0,
    "perMeal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_role_idx" ON "User"("status", "role");

-- CreateIndex
CREATE INDEX "User_lastName_firstName_idx" ON "User"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_date_key" ON "Menu"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Dish_menuId_course_key" ON "Dish"("menuId", "course");

-- CreateIndex
CREATE INDEX "Reservation_date_status_idx" ON "Reservation"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_userId_date_key" ON "Reservation"("userId", "date");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_cashSessionId_idx" ON "Transaction"("cashSessionId");

-- CreateIndex
CREATE INDEX "CashSession_cashierId_status_idx" ON "CashSession"("cashierId", "status");

-- CreateIndex
CREATE INDEX "CashSession_openedAt_idx" ON "CashSession"("openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_name_key" ON "StockItem"("name");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_servedById_fkey" FOREIGN KEY ("servedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Garde-fous métier au niveau de la base
ALTER TABLE "User" ADD CONSTRAINT "User_balance_non_negative" CHECK ("balance" >= 0);
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_float_non_negative" CHECK ("openingFloat" >= 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_not_zero" CHECK ("amount" <> 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_balance_non_negative" CHECK ("balanceAfter" >= 0);
-- Un caissier ne peut avoir qu'une session de caisse ouverte à la fois
CREATE UNIQUE INDEX "CashSession_one_open_per_cashier" ON "CashSession"("cashierId") WHERE "status" = 'OPEN';
-- Une seule écriture de repas par réservation (empêche le double débit)
CREATE UNIQUE INDEX "Transaction_one_meal_per_reservation" ON "Transaction"("reservationId") WHERE "type" = 'MEAL';
