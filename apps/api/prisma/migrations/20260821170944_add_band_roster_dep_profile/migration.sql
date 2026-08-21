-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "availabilityNotes" TEXT,
ADD COLUMN     "equipmentNotes" TEXT,
ADD COLUMN     "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "outfitNotes" TEXT,
ADD COLUMN     "primaryBandRole" TEXT,
ADD COLUMN     "travelNotes" TEXT;
