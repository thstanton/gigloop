-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'UPLOAD';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "name" TEXT;
