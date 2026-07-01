-- #533: music form draft -> published. Null = draft (private), set = published (client-visible).
-- AlterTable
ALTER TABLE "MusicFormConfig" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Backfill: every config that exists at deploy is already client-visible under the old
-- present==visible rule, so publish them all to avoid a client-facing regression (a form mid-booking
-- must not vanish). This runs exactly once as part of the migration, so it is inherently safe: only
-- rows created before this migration are touched, and forms created afterwards default to draft
-- (publishedAt NULL). The single-run guarantee IS the deploy cutoff — no re-run can publish a later
-- draft (contrast a standalone WHERE publishedAt IS NULL script, which would).
UPDATE "MusicFormConfig" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;
