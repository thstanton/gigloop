-- AlterTable: add nullable documentId FK to Communication, linking to the attached PDF Document
ALTER TABLE "Communication" ADD COLUMN "documentId" TEXT;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
