-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "seriesId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Communication_seriesId_idx" ON "Communication"("seriesId");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
