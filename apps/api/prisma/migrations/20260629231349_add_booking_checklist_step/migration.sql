-- CreateTable
CREATE TABLE "BookingChecklistStep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookingId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "key" TEXT,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MILESTONE',
    "completeMode" TEXT NOT NULL DEFAULT 'ACTION',
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "completedBy" TEXT NOT NULL DEFAULT 'USER',
    "completedAt" TIMESTAMP(3),
    "autoCompleteRule" JSONB,
    "dueDateRule" JSONB,

    CONSTRAINT "BookingChecklistStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingChecklistStep_userId_idx" ON "BookingChecklistStep"("userId");

-- CreateIndex
CREATE INDEX "BookingChecklistStep_bookingId_idx" ON "BookingChecklistStep"("bookingId");

-- CreateIndex
CREATE INDEX "BookingChecklistStep_goalId_idx" ON "BookingChecklistStep"("goalId");

-- AddForeignKey
ALTER TABLE "BookingChecklistStep" ADD CONSTRAINT "BookingChecklistStep_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "BookingChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

