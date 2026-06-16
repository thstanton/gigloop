-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "sourceBookingId" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceLineItem_sourceBookingId_idx" ON "InvoiceLineItem"("sourceBookingId");

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_sourceBookingId_fkey" FOREIGN KEY ("sourceBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
