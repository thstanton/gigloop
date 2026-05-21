-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('ENQUIRY', 'CONFIRMED', 'INVOICED', 'SETTLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WEDDING', 'CORPORATE', 'PRIVATE', 'RESIDENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'INVOICE');

-- CreateEnum
CREATE TYPE "SongGenre" AS ENUM ('CONTEMPORARY', 'CLASSICAL', 'JAZZ', 'FILM_TV_MUSICALS', 'BOLLYWOOD', 'CHRISTMAS');

-- CreateTable
CREATE TABLE "PublicProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT,
    "bio" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "brandColour" TEXT,
    "photo" TEXT,
    "website" TEXT,
    "socials" JSONB,
    "portalTheme" TEXT NOT NULL DEFAULT 'LIGHT',

    CONSTRAINT "PublicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "bankDetails" TEXT,
    "vatNumber" TEXT,
    "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 14,
    "invoiceNumberSequence" INTEGER NOT NULL DEFAULT 0,
    "invoiceSequenceYear" INTEGER NOT NULL DEFAULT 0,
    "depositTrackingMode" TEXT NOT NULL DEFAULT 'INVOICE',

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "parkingInfo" TEXT,
    "accessInfo" TEXT,
    "equipmentAvailable" TEXT,
    "website" TEXT,
    "commissionArrangement" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'ENQUIRY',
    "eventType" "EventType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "fee" DECIMAL(10,2),
    "notes" TEXT,
    "portalToken" TEXT NOT NULL,
    "contractSignedAt" TIMESTAMP(3),
    "depositReceivedAt" TIMESTAMP(3),
    "depositTrackingMode" TEXT,
    "customerId" TEXT NOT NULL,
    "venueId" TEXT,
    "referrerId" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "startTime" TEXT,
    "label" TEXT,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "PerformanceSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "isDeposit" BOOLEAN NOT NULL DEFAULT false,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "bookingId" TEXT NOT NULL,
    "billToContactId" TEXT NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "builtInType" TEXT,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookingId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "templateId" TEXT,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "DocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "invoiceId" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "genre" "SongGenre" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicFormConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enabledGenres" "SongGenre"[],
    "keyMoments" TEXT[],
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "MusicFormConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicFormResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "selectedSongIds" TEXT[],
    "specialRequests" JSONB NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "MusicFormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicProfile_userId_key" ON "PublicProfile"("userId");

-- CreateIndex
CREATE INDEX "PublicProfile_userId_idx" ON "PublicProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_portalToken_key" ON "Booking"("portalToken");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_venueId_idx" ON "Booking"("venueId");

-- CreateIndex
CREATE INDEX "Booking_referrerId_idx" ON "Booking"("referrerId");

-- CreateIndex
CREATE INDEX "PerformanceSet_userId_idx" ON "PerformanceSet"("userId");

-- CreateIndex
CREATE INDEX "PerformanceSet_bookingId_idx" ON "PerformanceSet"("bookingId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_bookingId_idx" ON "Invoice"("bookingId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_userId_idx" ON "InvoiceLineItem"("userId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "Template_userId_idx" ON "Template"("userId");

-- CreateIndex
CREATE INDEX "Communication_userId_idx" ON "Communication"("userId");

-- CreateIndex
CREATE INDEX "Communication_bookingId_idx" ON "Communication"("bookingId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_bookingId_idx" ON "Document"("bookingId");

-- CreateIndex
CREATE INDEX "Song_userId_idx" ON "Song"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicFormConfig_bookingId_key" ON "MusicFormConfig"("bookingId");

-- CreateIndex
CREATE INDEX "MusicFormConfig_userId_idx" ON "MusicFormConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicFormResponse_bookingId_key" ON "MusicFormResponse"("bookingId");

-- CreateIndex
CREATE INDEX "MusicFormResponse_userId_idx" ON "MusicFormResponse"("userId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceSet" ADD CONSTRAINT "PerformanceSet_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billToContactId_fkey" FOREIGN KEY ("billToContactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicFormConfig" ADD CONSTRAINT "MusicFormConfig_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicFormResponse" ADD CONSTRAINT "MusicFormResponse_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
