-- #499 Schema rename: Package→PackageTemplate, PackageSlot→PackageTemplateSlot, BookingPackage→Package (booking-owned, snapshot label/icon)
--
-- Safe ordering:
--   1. Drop FKs referencing the old Package table
--   2. Rename Package → PackageTemplate (the library table)
--   3. Rename PackageSlot → PackageTemplateSlot, rename FK column
--   4. Snapshot label + icon onto BookingPackage rows from their source PackageTemplate
--   5. Repoint PerformanceSet.packageId from template-IDs to BookingPackage.id
--   6. Null out any sets still pointing to template IDs (orphan guard)
--   7. Drop the packageId index + column from BookingPackage (provenance severed)
--   8. Rename BookingPackage → Package
--   9. Re-add all FKs with new names
--  10. Rename PKs, constraints, and indexes to match Prisma's expected naming

-- ─── Step 1: Drop FKs referencing old Package ──────────────────────────────────

ALTER TABLE "PerformanceSet" DROP CONSTRAINT "PerformanceSet_packageId_fkey";
ALTER TABLE "BookingPackage" DROP CONSTRAINT "BookingPackage_packageId_fkey";
ALTER TABLE "PackageSlot" DROP CONSTRAINT "PackageSlot_packageId_fkey";

-- ─── Step 2: Rename Package → PackageTemplate ─────────────────────────────────

ALTER TABLE "Package" RENAME TO "PackageTemplate";

-- ─── Step 3: Rename PackageSlot → PackageTemplateSlot, rename FK column ───────

ALTER TABLE "PackageSlot" RENAME TO "PackageTemplateSlot";
ALTER TABLE "PackageTemplateSlot" RENAME COLUMN "packageId" TO "packageTemplateId";

-- ─── Step 4: Snapshot label + icon onto BookingPackage rows ───────────────────

ALTER TABLE "BookingPackage" ADD COLUMN "label" TEXT;
ALTER TABLE "BookingPackage" ADD COLUMN "icon" TEXT;

UPDATE "BookingPackage" bp
SET "label" = pt."label",
    "icon"  = pt."icon"
FROM "PackageTemplate" pt
WHERE bp."packageId" = pt."id";

ALTER TABLE "BookingPackage" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE "BookingPackage" ALTER COLUMN "icon"  SET NOT NULL;

-- ─── Step 5: Repoint PerformanceSet.packageId from template-IDs to BookingPackage.id ─

-- Before: ps.packageId = template_id
-- After:  ps.packageId = booking_package_id  (the snapshot row that owns the sets)
UPDATE "PerformanceSet" ps
SET "packageId" = bp."id"
FROM "BookingPackage" bp
WHERE ps."bookingId" = bp."bookingId"
  AND ps."packageId" = bp."packageId";

-- ─── Step 6: Null out any sets still pointing to template IDs (orphan guard) ──

UPDATE "PerformanceSet" ps
SET "packageId" = NULL
WHERE "packageId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "BookingPackage" bp WHERE bp."id" = ps."packageId"
  );

-- ─── Step 7: Drop packageId index + column from BookingPackage ────────────────

DROP INDEX "BookingPackage_packageId_idx";
ALTER TABLE "BookingPackage" DROP COLUMN "packageId";

-- ─── Step 8: Rename BookingPackage → Package ──────────────────────────────────

ALTER TABLE "BookingPackage" RENAME TO "Package";

-- ─── Step 9: Re-add FKs with new names ───────────────────────────────────────

-- PackageTemplateSlot.packageTemplateId → PackageTemplate.id
ALTER TABLE "PackageTemplateSlot"
  ADD CONSTRAINT "PackageTemplateSlot_packageTemplateId_fkey"
  FOREIGN KEY ("packageTemplateId") REFERENCES "PackageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PerformanceSet.packageId → Package.id (booking-owned; was pointing to template, now to snapshot)
ALTER TABLE "PerformanceSet"
  ADD CONSTRAINT "PerformanceSet_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Step 10: Rename PKs, constraints, and indexes ────────────────────────────

-- Rename PackageTemplate_pkey BEFORE renaming BookingPackage→Package's pkey to Package_pkey
-- (index names must be unique within schema — free up "Package_pkey" first)
ALTER TABLE "PackageTemplate" RENAME CONSTRAINT "Package_pkey" TO "PackageTemplate_pkey";
ALTER TABLE "PackageTemplateSlot" RENAME CONSTRAINT "PackageSlot_pkey" TO "PackageTemplateSlot_pkey";
ALTER TABLE "Package" RENAME CONSTRAINT "BookingPackage_pkey" TO "Package_pkey";

-- Rename Package.bookingId FK (was BookingPackage_bookingId_fkey)
ALTER TABLE "Package" RENAME CONSTRAINT "BookingPackage_bookingId_fkey" TO "Package_bookingId_fkey";

-- Rename indexes on PackageTemplate (was Package)
ALTER INDEX "Package_userId_idx" RENAME TO "PackageTemplate_userId_idx";

-- Rename indexes on PackageTemplateSlot (was PackageSlot)
ALTER INDEX "PackageSlot_userId_idx" RENAME TO "PackageTemplateSlot_userId_idx";
ALTER INDEX "PackageSlot_packageId_idx" RENAME TO "PackageTemplateSlot_packageTemplateId_idx";

-- Rename indexes on Package (was BookingPackage); free up "Package_userId_idx" first by renaming it above
ALTER INDEX "BookingPackage_userId_idx" RENAME TO "Package_userId_idx";
ALTER INDEX "BookingPackage_bookingId_idx" RENAME TO "Package_bookingId_idx";
