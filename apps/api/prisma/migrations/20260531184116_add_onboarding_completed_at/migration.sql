-- AlterTable
ALTER TABLE "BookingPackage" RENAME CONSTRAINT "BookingPerformanceFormat_pkey" TO "BookingPackage_pkey";

-- AlterTable
ALTER TABLE "Package" RENAME CONSTRAINT "PerformanceFormat_pkey" TO "Package_pkey";

-- AlterTable
ALTER TABLE "PackageSlot" RENAME CONSTRAINT "PerformanceFormatSlot_pkey" TO "PackageSlot_pkey";

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- RenameForeignKey
ALTER TABLE "BookingPackage" RENAME CONSTRAINT "BookingPerformanceFormat_bookingId_fkey" TO "BookingPackage_bookingId_fkey";

-- RenameForeignKey
ALTER TABLE "BookingPackage" RENAME CONSTRAINT "BookingPerformanceFormat_performanceFormatId_fkey" TO "BookingPackage_packageId_fkey";

-- RenameForeignKey
ALTER TABLE "PackageSlot" RENAME CONSTRAINT "PerformanceFormatSlot_performanceFormatId_fkey" TO "PackageSlot_packageId_fkey";

-- RenameForeignKey
ALTER TABLE "PerformanceSet" RENAME CONSTRAINT "PerformanceSet_performanceFormatId_fkey" TO "PerformanceSet_packageId_fkey";
