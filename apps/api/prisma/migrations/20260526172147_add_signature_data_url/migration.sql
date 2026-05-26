/*
  Warnings:

  - Made the column `keyMoments` on table `MusicFormConfig` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "signatureDataUrl" TEXT;

-- AlterTable
ALTER TABLE "MusicFormConfig" ALTER COLUMN "keyMoments" SET NOT NULL;

-- AlterTable
ALTER TABLE "PerformanceFormat" ALTER COLUMN "keyMoments" DROP DEFAULT,
ALTER COLUMN "defaultGenreSelection" DROP DEFAULT;
