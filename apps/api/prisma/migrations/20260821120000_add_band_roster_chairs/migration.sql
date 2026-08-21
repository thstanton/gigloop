◇ injected env (14) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
-- CreateTable
CREATE TABLE "BookingBandChair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "bookingId" TEXT NOT NULL,
    "packageId" TEXT,
    "memberId" TEXT,

    CONSTRAINT "BookingBandChair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingBandChair_userId_idx" ON "BookingBandChair"("userId");

-- CreateIndex
CREATE INDEX "BookingBandChair_bookingId_idx" ON "BookingBandChair"("bookingId");

-- CreateIndex
CREATE INDEX "BookingBandChair_packageId_idx" ON "BookingBandChair"("packageId");

-- AddForeignKey
ALTER TABLE "BookingBandChair" ADD CONSTRAINT "BookingBandChair_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBandChair" ADD CONSTRAINT "BookingBandChair_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

