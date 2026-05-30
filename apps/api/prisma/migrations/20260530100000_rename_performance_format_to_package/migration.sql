-- Rename tables
ALTER TABLE "PerformanceFormat" RENAME TO "Package";
ALTER TABLE "PerformanceFormatSlot" RENAME TO "PackageSlot";
ALTER TABLE "BookingPerformanceFormat" RENAME TO "BookingPackage";

-- Rename FK column on PackageSlot
ALTER TABLE "PackageSlot" RENAME COLUMN "performanceFormatId" TO "packageId";

-- Rename FK column on BookingPackage
ALTER TABLE "BookingPackage" RENAME COLUMN "performanceFormatId" TO "packageId";

-- Rename FK column on PerformanceSet
ALTER TABLE "PerformanceSet" RENAME COLUMN "performanceFormatId" TO "packageId";

-- Add new columns to Package
ALTER TABLE "Package" ADD COLUMN "isSystemDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Package" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

-- Rename indexes (Prisma-generated index names reference the old model names)
ALTER INDEX IF EXISTS "PerformanceFormat_userId_idx" RENAME TO "Package_userId_idx";
ALTER INDEX IF EXISTS "PerformanceFormatSlot_userId_idx" RENAME TO "PackageSlot_userId_idx";
ALTER INDEX IF EXISTS "PerformanceFormatSlot_performanceFormatId_idx" RENAME TO "PackageSlot_packageId_idx";
ALTER INDEX IF EXISTS "BookingPerformanceFormat_userId_idx" RENAME TO "BookingPackage_userId_idx";
ALTER INDEX IF EXISTS "BookingPerformanceFormat_bookingId_idx" RENAME TO "BookingPackage_bookingId_idx";
ALTER INDEX IF EXISTS "BookingPerformanceFormat_performanceFormatId_idx" RENAME TO "BookingPackage_packageId_idx";
ALTER INDEX IF EXISTS "PerformanceSet_performanceFormatId_idx" RENAME TO "PerformanceSet_packageId_idx";
