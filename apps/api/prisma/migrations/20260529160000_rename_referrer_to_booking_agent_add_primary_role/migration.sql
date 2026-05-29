-- AlterTable: rename referrerId -> bookingAgentId on Booking
ALTER TABLE "Booking" RENAME COLUMN "referrerId" TO "bookingAgentId";

-- DropIndex
DROP INDEX IF EXISTS "Booking_referrerId_idx";

-- CreateIndex
CREATE INDEX "Booking_bookingAgentId_idx" ON "Booking"("bookingAgentId");

-- AlterTable: add primaryRole to Contact
ALTER TABLE "Contact" ADD COLUMN "primaryRole" TEXT;
