-- #883 (Band members v1, ADR-0072 §3, §8): the lineup template library — "my five-piece" — as
-- the first slice of the whole band-roster feature. Symmetric with PackageTemplate →
-- PackageTemplateSlot (ADR-0046). All additive: two new tables, two new nullable columns on
-- existing tables, nothing narrowed and nothing NOT NULL on existing data.
--
-- Hand-authored via `prisma migrate diff --from-schema-datamodel <pre-#883 schema>
-- --to-schema-datamodel <post-#883 schema> --script` (no DB connection involved) rather than
-- `migrate dev`, per CLAUDE.md: database migrations are never run without a human confirming
-- first. This file is left for a human to apply.

-- AlterTable
ALTER TABLE "PackageTemplate" ADD COLUMN     "defaultLineupTemplateId" TEXT;

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "lineupName" TEXT;

-- CreateTable
CREATE TABLE "LineupTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "LineupTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupTemplateSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "lineupTemplateId" TEXT NOT NULL,

    CONSTRAINT "LineupTemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineupTemplate_userId_idx" ON "LineupTemplate"("userId");

-- CreateIndex
CREATE INDEX "LineupTemplateSlot_userId_idx" ON "LineupTemplateSlot"("userId");

-- CreateIndex
CREATE INDEX "LineupTemplateSlot_lineupTemplateId_idx" ON "LineupTemplateSlot"("lineupTemplateId");

-- CreateIndex
CREATE INDEX "PackageTemplate_defaultLineupTemplateId_idx" ON "PackageTemplate"("defaultLineupTemplateId");

-- AddForeignKey
ALTER TABLE "PackageTemplate" ADD CONSTRAINT "PackageTemplate_defaultLineupTemplateId_fkey" FOREIGN KEY ("defaultLineupTemplateId") REFERENCES "LineupTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupTemplateSlot" ADD CONSTRAINT "LineupTemplateSlot_lineupTemplateId_fkey" FOREIGN KEY ("lineupTemplateId") REFERENCES "LineupTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
