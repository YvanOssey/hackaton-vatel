-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "pickupSlot" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "pickupCapacity" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "serviceEnd" TEXT NOT NULL DEFAULT '14:00',
ADD COLUMN     "serviceStart" TEXT NOT NULL DEFAULT '11:30';

-- CreateIndex
CREATE INDEX "Reservation_date_pickupSlot_idx" ON "Reservation"("date", "pickupSlot");


-- Contraintes : créneau au format HH:MM, horaires valides, capacité raisonnable
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pickupSlot_check" CHECK ("pickupSlot" IS NULL OR "pickupSlot" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_service_hours_check" CHECK ("serviceStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "serviceEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "serviceStart" < "serviceEnd");
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_pickupCapacity_check" CHECK ("pickupCapacity" BETWEEN 1 AND 500);
