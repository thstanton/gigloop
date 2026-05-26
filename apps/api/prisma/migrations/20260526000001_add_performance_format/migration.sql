-- CreateTable PerformanceFormat
CREATE TABLE "PerformanceFormat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "icon" TEXT NOT NULL,
    "keyMoments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "defaultGenreSelection" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,

    CONSTRAINT "PerformanceFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable PerformanceFormatSlot
CREATE TABLE "PerformanceFormatSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "performanceFormatId" TEXT NOT NULL,

    CONSTRAINT "PerformanceFormatSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable BookingPerformanceFormat
CREATE TABLE "BookingPerformanceFormat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL,
    "bookingId" TEXT NOT NULL,
    "performanceFormatId" TEXT NOT NULL,

    CONSTRAINT "BookingPerformanceFormat_pkey" PRIMARY KEY ("id")
);

-- AlterTable PerformanceSet: add nullable performanceFormatId FK
ALTER TABLE "PerformanceSet" ADD COLUMN "performanceFormatId" TEXT;

-- AlterTable MusicFormConfig: keyMoments String[] -> Json
ALTER TABLE "MusicFormConfig"
    ALTER COLUMN "keyMoments" DROP DEFAULT,
    ALTER COLUMN "keyMoments" TYPE JSONB USING to_jsonb("keyMoments");
ALTER TABLE "MusicFormConfig" ALTER COLUMN "keyMoments" SET DEFAULT '[]';

-- CreateIndex
CREATE INDEX "PerformanceFormat_userId_idx" ON "PerformanceFormat"("userId");
CREATE INDEX "PerformanceFormatSlot_userId_idx" ON "PerformanceFormatSlot"("userId");
CREATE INDEX "PerformanceFormatSlot_performanceFormatId_idx" ON "PerformanceFormatSlot"("performanceFormatId");
CREATE INDEX "BookingPerformanceFormat_userId_idx" ON "BookingPerformanceFormat"("userId");
CREATE INDEX "BookingPerformanceFormat_bookingId_idx" ON "BookingPerformanceFormat"("bookingId");
CREATE INDEX "BookingPerformanceFormat_performanceFormatId_idx" ON "BookingPerformanceFormat"("performanceFormatId");
CREATE INDEX "PerformanceSet_performanceFormatId_idx" ON "PerformanceSet"("performanceFormatId");

-- AddForeignKey
ALTER TABLE "PerformanceFormatSlot" ADD CONSTRAINT "PerformanceFormatSlot_performanceFormatId_fkey"
    FOREIGN KEY ("performanceFormatId") REFERENCES "PerformanceFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingPerformanceFormat" ADD CONSTRAINT "BookingPerformanceFormat_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingPerformanceFormat" ADD CONSTRAINT "BookingPerformanceFormat_performanceFormatId_fkey"
    FOREIGN KEY ("performanceFormatId") REFERENCES "PerformanceFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PerformanceSet" ADD CONSTRAINT "PerformanceSet_performanceFormatId_fkey"
    FOREIGN KEY ("performanceFormatId") REFERENCES "PerformanceFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
