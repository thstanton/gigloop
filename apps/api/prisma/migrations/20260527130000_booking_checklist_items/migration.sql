CREATE TABLE "BookingChecklistItem" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"           TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bookingId"        TEXT NOT NULL,
  "key"              TEXT,
  "label"            TEXT NOT NULL,
  "completedBy"      TEXT NOT NULL DEFAULT 'USER',
  "state"            TEXT NOT NULL DEFAULT 'PENDING',
  "order"            INTEGER NOT NULL,
  "dependsOn"        TEXT[] NOT NULL DEFAULT '{}',
  "autoCompleteRule" JSONB,
  "requiredForStatus" TEXT,
  "completedAt"      TIMESTAMP(3),
  "dueDate"          TIMESTAMP(3),
  "dueDateRule"      JSONB,

  CONSTRAINT "BookingChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingChecklistItem_userId_idx" ON "BookingChecklistItem"("userId");
CREATE INDEX "BookingChecklistItem_bookingId_idx" ON "BookingChecklistItem"("bookingId");

ALTER TABLE "BookingChecklistItem"
  ADD CONSTRAINT "BookingChecklistItem_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
