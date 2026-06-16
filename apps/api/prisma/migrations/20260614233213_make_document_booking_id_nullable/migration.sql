-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "bookingId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_invoiceId_idx" ON "Document"("invoiceId");
