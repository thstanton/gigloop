-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "vatRate" INTEGER NOT NULL DEFAULT 20;

-- RenameForeignKey
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_referrerId_fkey" TO "Booking_bookingAgentId_fkey";
