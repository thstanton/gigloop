-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "status" "CommunicationStatus" NOT NULL DEFAULT 'SENT',
ALTER COLUMN "sentAt" DROP NOT NULL,
ALTER COLUMN "sentAt" DROP DEFAULT;
