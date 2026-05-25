-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "invoiceNumber" TEXT,
ALTER COLUMN "issueDate" DROP NOT NULL,
ALTER COLUMN "issueDate" DROP DEFAULT;
