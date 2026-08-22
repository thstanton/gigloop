-- ADR-0081: a Lineup is a booking-owned instance, not a tag on its chairs.
--
-- This repo carries no production data for this change: v0.8.0 was tagged 2026-08-20, #970
-- (which introduced BookingBandChair.packageId / Package.lineupName) merged 2026-08-21, and the
-- roster tables live only on preprod's synthetic seed data behind default-off
-- FEATURE_BAND_MEMBERS. This is a plain replace, not an expand/contract migration. The backfill
-- below exists only so existing local/preprod seed rows survive the migration intact.

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupPackage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lineupId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,

    CONSTRAINT "LineupPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lineup_userId_idx" ON "Lineup"("userId");

-- CreateIndex
CREATE INDEX "Lineup_bookingId_idx" ON "Lineup"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupPackage_lineupId_packageId_key" ON "LineupPackage"("lineupId", "packageId");

-- CreateIndex
CREATE INDEX "LineupPackage_userId_idx" ON "LineupPackage"("userId");

-- CreateIndex
CREATE INDEX "LineupPackage_packageId_idx" ON "LineupPackage"("packageId");

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPackage" ADD CONSTRAINT "LineupPackage_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPackage" ADD CONSTRAINT "LineupPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: one Lineup per (bookingId, packageId) pairing that has existing chairs,
-- snapshotting the package's lineupName; one Lineup per bookingId for package-less ("whole day")
-- chairs, with no LineupPackage link — the same rule ADR-0081 §4 states for new writes.
CREATE TEMP TABLE "_lineup_backfill_by_package" AS
SELECT gen_random_uuid() AS lineup_id, grp."bookingId", grp."userId", grp."packageId", pkg."lineupName"
FROM (
  SELECT DISTINCT "bookingId", "userId", "packageId"
  FROM "BookingBandChair"
  WHERE "packageId" IS NOT NULL
) grp
JOIN "Package" pkg ON pkg."id" = grp."packageId";

CREATE TEMP TABLE "_lineup_backfill_whole_day" AS
SELECT gen_random_uuid() AS lineup_id, grp."bookingId", grp."userId"
FROM (
  SELECT DISTINCT "bookingId", "userId"
  FROM "BookingBandChair"
  WHERE "packageId" IS NULL
) grp;

INSERT INTO "Lineup" ("id", "userId", "createdAt", "updatedAt", "label", "bookingId")
SELECT lineup_id, "userId", now(), now(), "lineupName", "bookingId" FROM "_lineup_backfill_by_package"
UNION ALL
SELECT lineup_id, "userId", now(), now(), NULL, "bookingId" FROM "_lineup_backfill_whole_day";

INSERT INTO "LineupPackage" ("id", "userId", "createdAt", "updatedAt", "lineupId", "packageId")
SELECT gen_random_uuid(), "userId", now(), now(), lineup_id, "packageId" FROM "_lineup_backfill_by_package";

-- AlterTable (add nullable, backfill, then enforce NOT NULL)
ALTER TABLE "BookingBandChair" ADD COLUMN "lineupId" TEXT;

UPDATE "BookingBandChair" c
SET "lineupId" = b.lineup_id
FROM "_lineup_backfill_by_package" b
WHERE c."bookingId" = b."bookingId" AND c."packageId" = b."packageId";

UPDATE "BookingBandChair" c
SET "lineupId" = w.lineup_id
FROM "_lineup_backfill_whole_day" w
WHERE c."bookingId" = w."bookingId" AND c."packageId" IS NULL;

DROP TABLE "_lineup_backfill_by_package";
DROP TABLE "_lineup_backfill_whole_day";

ALTER TABLE "BookingBandChair" ALTER COLUMN "lineupId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "BookingBandChair" DROP CONSTRAINT "BookingBandChair_packageId_fkey";

-- DropIndex
DROP INDEX "BookingBandChair_packageId_idx";

-- AlterTable
ALTER TABLE "BookingBandChair" DROP COLUMN "packageId";

-- AddForeignKey
ALTER TABLE "BookingBandChair" ADD CONSTRAINT "BookingBandChair_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "BookingBandChair_lineupId_idx" ON "BookingBandChair"("lineupId");

-- AlterTable (Package.lineupName retires to Lineup.label, which is where the snapshot belonged)
ALTER TABLE "Package" DROP COLUMN "lineupName";
