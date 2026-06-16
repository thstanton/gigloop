-- AlterEnum
-- Add ISSUED between DRAFT and SENT in the InvoiceStatus enum.
-- Non-destructive: existing rows are unaffected.
ALTER TYPE "InvoiceStatus" ADD VALUE 'ISSUED' AFTER 'DRAFT';
