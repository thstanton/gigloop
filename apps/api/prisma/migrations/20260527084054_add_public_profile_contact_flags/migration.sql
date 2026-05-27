-- AlterTable
ALTER TABLE "PublicProfile" ADD COLUMN     "portalHeroImage" TEXT,
ADD COLUMN     "showContactEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showContactPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showContactPhoto" BOOLEAN NOT NULL DEFAULT false;
