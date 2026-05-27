BEGIN;

-- Create Contract table
CREATE TABLE "Contract" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"           TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bookingId"        TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'DRAFT',
  "content"          JSONB NOT NULL,
  "signedAt"         TIMESTAMP(3),
  "signedFromIp"     TEXT,
  "signatureDataUrl" TEXT,
  "voidedAt"         TIMESTAMP(3),

  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contract_userId_idx" ON "Contract"("userId");
CREATE INDEX "Contract_bookingId_idx" ON "Contract"("bookingId");

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing contract data from Booking into Contract rows
INSERT INTO "Contract" (
  "id", "userId", "createdAt", "updatedAt",
  "bookingId", "status", "content",
  "signedAt", "signedFromIp", "signatureDataUrl"
)
SELECT
  gen_random_uuid()::text,
  "userId",
  COALESCE("contractSignedAt", NOW()),
  COALESCE("contractSignedAt", NOW()),
  "id",
  CASE WHEN "contractSignedAt" IS NOT NULL THEN 'SIGNED' ELSE 'DRAFT' END,
  "contractContent",
  "contractSignedAt",
  "contractSignedFromIp",
  "signatureDataUrl"
FROM "Booking"
WHERE "contractContent" IS NOT NULL;

-- Drop old contract columns from Booking
ALTER TABLE "Booking"
  DROP COLUMN IF EXISTS "contractContent",
  DROP COLUMN IF EXISTS "contractSignedAt",
  DROP COLUMN IF EXISTS "contractSignedFromIp",
  DROP COLUMN IF EXISTS "signatureDataUrl";

COMMIT;
