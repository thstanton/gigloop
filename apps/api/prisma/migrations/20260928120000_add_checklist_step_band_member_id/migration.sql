-- AlterTable
ALTER TABLE "BookingChecklistStep" ADD COLUMN "bandMemberId" TEXT;

-- CreateIndex
CREATE INDEX "BookingChecklistStep_bandMemberId_idx" ON "BookingChecklistStep"("bandMemberId");

-- AddForeignKey
ALTER TABLE "BookingChecklistStep" ADD CONSTRAINT "BookingChecklistStep_bandMemberId_fkey" FOREIGN KEY ("bandMemberId") REFERENCES "BookingBandMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
