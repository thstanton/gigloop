-- AlterEnum: replace INVOICED/SETTLED/COMPLETED with READY/COMPLETE
-- Data migration: INVOICED → CONFIRMED, SETTLED → CONFIRMED, COMPLETED → COMPLETE
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('ENQUIRY', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED');
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING (
  CASE "status"::text
    WHEN 'INVOICED'  THEN 'CONFIRMED'::"BookingStatus_new"
    WHEN 'SETTLED'   THEN 'CONFIRMED'::"BookingStatus_new"
    WHEN 'COMPLETED' THEN 'COMPLETE'::"BookingStatus_new"
    ELSE "status"::text::"BookingStatus_new"
  END
);
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'ENQUIRY';
COMMIT;
