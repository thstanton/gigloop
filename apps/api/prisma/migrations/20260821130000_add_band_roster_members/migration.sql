-- CreateTable
CREATE TABLE "BookingBandMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookingId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "bandPortalToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ADDED',
    "isSelf" BOOLEAN NOT NULL DEFAULT false,
    "sessionFee" DECIMAL(10,2),
    "invitedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "BookingBandMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingBandMember_bandPortalToken_key" ON "BookingBandMember"("bandPortalToken");

-- CreateIndex
CREATE INDEX "BookingBandMember_userId_idx" ON "BookingBandMember"("userId");

-- CreateIndex
CREATE INDEX "BookingBandMember_bookingId_idx" ON "BookingBandMember"("bookingId");

-- CreateIndex
CREATE INDEX "BookingBandMember_contactId_idx" ON "BookingBandMember"("contactId");

-- CreateIndex
CREATE INDEX "BookingBandChair_memberId_idx" ON "BookingBandChair"("memberId");

-- AddForeignKey
ALTER TABLE "BookingBandChair" ADD CONSTRAINT "BookingBandChair_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "BookingBandMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBandMember" ADD CONSTRAINT "BookingBandMember_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBandMember" ADD CONSTRAINT "BookingBandMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

