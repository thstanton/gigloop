/*
  Warnings:

  - You are about to drop the column `address` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `UserProfile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "travelMode" TEXT;

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "address",
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'GB',
ADD COLUMN     "county" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "travelDistanceMetres" INTEGER,
ADD COLUMN     "travelMode" TEXT,
ADD COLUMN     "travelTimeCalculatedAt" TIMESTAMP(3),
ADD COLUMN     "travelTimeMinutes" INTEGER;

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "address",
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "county" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "postcode" TEXT;
